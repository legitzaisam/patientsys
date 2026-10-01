#!/usr/bin/env bash
# Shared functions for launch-plan/cloudflare/*.sh. Sourced, never run.
#
# The public stack served through a Cloudflare Tunnel:
#
#   website (static build) ┐
#                          ├─> gateway :$GATEWAY_PORT ──> cloudflared ──> https://$PUBLIC_DOMAIN
#   demo app :$APP_PORT    ┘
#
# The app and the website run from snapshots under launch-plan/.run/ so a
# rebuild never touches what is being served; a redeploy swaps the snapshot.
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../scripts" && pwd)/load-env.sh"

CF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE_DIR="$LAUNCH_DIR/website"
APP_LIVE="$RUN_DIR/app-live"
APP_NEXT="$RUN_DIR/app-next"
SITE_LIVE="$RUN_DIR/website-live"
SITE_NEXT="$RUN_DIR/website-next"
export CF_DIR SITE_DIR APP_LIVE APP_NEXT SITE_LIVE SITE_NEXT
# quic (UDP) is faster but breaks behind VPNs such as Tailscale and on UDP-filtering
# networks; http2 (TCP 7844) is the robust default here. Override in .env.local.
export TUNNEL_PROTOCOL="${TUNNEL_PROTOCOL:-http2}"

# Node 22 is required by both package.json files. If the default node is older
# and Homebrew's node@22 is installed, use it for this process only.
node_major() { node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0; }
if (( $(node_major) < 22 )); then
  for candidate in /opt/homebrew/opt/node@22/bin /usr/local/opt/node@22/bin; do
    if [[ -x "$candidate/node" ]]; then export PATH="$candidate:$PATH"; break; fi
  done
fi

pid_alive() { [[ -f "$RUN_DIR/$1.pid" ]] && kill -0 "$(cat "$RUN_DIR/$1.pid")" 2>/dev/null; }

stop_named() {
  local name="$1" pidfile="$RUN_DIR/$1.pid" pid
  [[ -f "$pidfile" ]] || return 0
  pid="$(cat "$pidfile")"
  if kill -0 "$pid" 2>/dev/null; then
    pkill -TERM -P "$pid" 2>/dev/null || true
    kill -TERM "$pid" 2>/dev/null || true
    for _ in 1 2 3 4 5 6 7 8 9 10; do kill -0 "$pid" 2>/dev/null || break; sleep 0.5; done
    kill -KILL "$pid" 2>/dev/null || true
    log "Stopped $name ($pid)"
  fi
  rm -f "$pidfile"
}

# --- demo app -------------------------------------------------------------
# Same environment as ngrok/start-demo.sh: demo fixtures, the website owns
# sign-in, the app knows its public origin, no live Supabase.
app_env() {
  export DEMO=1
  export DEMO_NOW="${DEMO_NOW:-}"
  export DEMO_SIGNIN_URL="${DEMO_SIGNIN_URL-/login}"
  export APP_ORIGIN="$PUBLIC_URL"
  export __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=".ngrok-free.dev,.ngrok-free.app,.ngrok.app,.ngrok.dev${NGROK_DOMAIN:+,$NGROK_DOMAIN}${PUBLIC_DOMAIN:+,$PUBLIC_DOMAIN}"
  if [[ ! -f "$APP_ROOT/.env" ]]; then
    export VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-https://demo.invalid}"
    export VITE_SUPABASE_PUBLISHABLE_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY:-demo-placeholder-key}"
    export VITE_SUPABASE_PROJECT_ID="${VITE_SUPABASE_PROJECT_ID:-demo}"
    export SUPABASE_URL="${SUPABASE_URL:-https://demo.invalid}"
    export SUPABASE_PUBLISHABLE_KEY="${SUPABASE_PUBLISHABLE_KEY:-demo-placeholder-key}"
  fi
}

# Build the demo bundle into the repo's .output, then snapshot it to app-next.
app_build() {
  app_env
  [[ -d "$APP_ROOT/node_modules" ]] || (cd "$APP_ROOT" && npm ci --no-audit --no-fund)
  log "Building the demo app (production build, DEMO=1)…"
  ( cd "$APP_ROOT" && NITRO_PRESET=node-server npx vite build --config "$LAUNCH_DIR/ngrok/vite.demo.config.ts" ) \
    >"$RUN_DIR/logs/app-build.log" 2>&1 || die "App build failed, see $RUN_DIR/logs/app-build.log"
  [[ -f "$APP_ROOT/.output/server/index.mjs" ]] || die "Build produced no .output/server/index.mjs"
  rm -rf "$APP_NEXT"
  cp -R "$APP_ROOT/.output" "$APP_NEXT"
  secrets_check "$APP_NEXT"
  log "App built ($(du -sh "$APP_NEXT" | cut -f1))."
}

# The live project ref must never be in a public bundle.
secrets_check() {
  local dir="$1" ref
  ref="$(sed -n 's/^SUPABASE_PROJECT_ID=//p' "$APP_ROOT/.env" 2>/dev/null | tr -d '"' | head -1)"
  if [[ -n "$ref" ]] && grep -rqs -- "$ref" "$dir/public" "$dir/server" 2>/dev/null; then
    die "The live Supabase project ref is in the built bundle. Set the VITE_SUPABASE_* placeholders in launch-plan/.env.local and rebuild."
  fi
}

app_start() {
  app_env
  if [[ -d "$APP_NEXT" ]]; then rm -rf "$APP_LIVE"; mv "$APP_NEXT" "$APP_LIVE"; fi
  [[ -f "$APP_LIVE/server/index.mjs" ]] || die "No app snapshot at $APP_LIVE; run app_build first."
  port_free "$APP_PORT" || die "Port $APP_PORT is busy. Run ./launch-plan/cloudflare/stop.sh or change APP_PORT."
  log "Starting the demo app on http://127.0.0.1:$APP_PORT"
  PORT="$APP_PORT" HOST=127.0.0.1 nohup node "$APP_LIVE/server/index.mjs" >"$RUN_DIR/logs/app.log" 2>&1 &
  echo $! >"$RUN_DIR/app.pid"
  wait_for_port "$APP_PORT" "The demo app" 60
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$APP_PORT/auth" || echo 000)
  [[ "$code" == 200 ]] || die "The app answered $code on /auth (see $RUN_DIR/logs/app.log)."
  log "Demo app is up."
}

app_stop() { stop_named app; }

# --- website --------------------------------------------------------------
site_build() {
  [[ -d "$SITE_DIR/node_modules" ]] || (cd "$SITE_DIR" && npm install --no-audit --no-fund)
  log "Building the website…"
  ( cd "$SITE_DIR" && SITE_URL="$PUBLIC_URL" npm run build ) >"$RUN_DIR/logs/website-build.log" 2>&1 \
    || die "Website build failed, see $RUN_DIR/logs/website-build.log"
  [[ -f "$SITE_DIR/dist/index.html" ]] || die "Website build produced no dist/index.html"
  rm -rf "$SITE_NEXT"
  cp -R "$SITE_DIR/dist" "$SITE_NEXT"
}

# Swap the served copy. The gateway reads files per request, so this is live at once.
site_publish() {
  [[ -d "$SITE_NEXT" ]] || die "No website build to publish; run site_build first."
  rm -rf "$SITE_LIVE.old"
  [[ -d "$SITE_LIVE" ]] && mv "$SITE_LIVE" "$SITE_LIVE.old"
  mv "$SITE_NEXT" "$SITE_LIVE"
  rm -rf "$SITE_LIVE.old"
  log "Website published."
}

# --- gateway --------------------------------------------------------------
gateway_start() {
  [[ -f "$SITE_LIVE/index.html" ]] || die "No website snapshot at $SITE_LIVE."
  port_free "$GATEWAY_PORT" || die "Port $GATEWAY_PORT is busy. Run ./launch-plan/cloudflare/stop.sh or change GATEWAY_PORT."
  log "Starting the gateway on http://localhost:$GATEWAY_PORT"
  GATEWAY_PORT="$GATEWAY_PORT" APP_PORT="$APP_PORT" WEBSITE_DIST="$SITE_LIVE" \
    DEMO_DEFAULT_ROLE="$DEMO_DEFAULT_ROLE" DEMO_SIGNIN_REDIRECT="${DEMO_SIGNIN_REDIRECT:-true}" \
    GATEWAY_QUIET="${GATEWAY_QUIET:-1}" \
    nohup node "$LAUNCH_DIR/gateway/server.mjs" >"$RUN_DIR/logs/gateway.log" 2>&1 &
  echo $! >"$RUN_DIR/gateway.pid"
  wait_for_port "$GATEWAY_PORT" "The gateway" 30
}

gateway_stop() { stop_named gateway; }

# --- tunnel ---------------------------------------------------------------
tunnel_args() {
  if [[ -n "$TUNNEL_TOKEN" ]]; then
    printf '%s\n' tunnel --protocol "$TUNNEL_PROTOCOL" run --token "$TUNNEL_TOKEN"
  else
    local cfg="${CLOUDFLARED_CONFIG/#\~/$HOME}"
    [[ -f "$cfg" ]] || die "No tunnel token and no config at $cfg (see cloudflare/README.md)."
    printf '%s\n' tunnel --config "$cfg" --protocol "$TUNNEL_PROTOCOL" run "$TUNNEL_NAME"
  fi
}

tunnel_start() {
  command -v cloudflared >/dev/null || die "cloudflared is not installed. Run: brew install cloudflared"
  [[ -n "$PUBLIC_DOMAIN" ]] || die "PUBLIC_DOMAIN is empty in launch-plan/.env.local."
  local args=()
  while IFS= read -r a; do args+=("$a"); done < <(tunnel_args)
  log "Opening the Cloudflare Tunnel for https://$PUBLIC_DOMAIN (protocol $TUNNEL_PROTOCOL)"
  nohup cloudflared --no-autoupdate "${args[@]}" >"$RUN_DIR/logs/cloudflared.log" 2>&1 &
  echo $! >"$RUN_DIR/cloudflared.pid"
  sleep 2
  pid_alive cloudflared || die "cloudflared exited at once, see $RUN_DIR/logs/cloudflared.log"
}

tunnel_stop() { stop_named cloudflared; }

# Poll the public URL until the edge answers through the tunnel.
wait_public() {
  local tries="${1:-45}" code
  for ((i = 0; i < tries; i++)); do
    code=$(curl -s -o /dev/null -m 5 -w '%{http_code}' "$PUBLIC_URL/healthz" || echo 000)
    if [[ "$code" == 200 ]]; then echo "$PUBLIC_URL" >"$RUN_DIR/public-url"; return 0; fi
    sleep 2
  done
  return 1
}

print_links() {
  cat <<INFO

  SQINOS is public:

    Website        $PUBLIC_URL/
    Sign in        $PUBLIC_URL/login
    Clinic demo    $PUBLIC_URL/demo/enter?role=owner
    Patient demo   $PUBLIC_URL/demo/enter?role=patient
    Local          http://localhost:$GATEWAY_PORT/

  Logs: $RUN_DIR/logs     Stop: ./launch-plan/cloudflare/stop.sh

INFO
}

# Keep the stack alive: restart any component that dies, until Ctrl-C.
# redeploy.sh may stop/start components underneath this loop on purpose.
supervise() {
  local tunnel="${1:-1}"
  log "Supervising (Ctrl-C stops everything)."
  while true; do
    sleep 5
    if ! pid_alive app; then
      log "Demo app is down; restarting from the last snapshot…"
      rm -f "$RUN_DIR/app.pid"; ( app_start ) || log "App restart failed, will retry."
    fi
    if ! pid_alive gateway; then
      log "Gateway is down; restarting…"
      rm -f "$RUN_DIR/gateway.pid"; ( gateway_start ) || log "Gateway restart failed, will retry."
    fi
    if [[ "$tunnel" == 1 ]] && ! pid_alive cloudflared; then
      log "Tunnel is down; restarting…"
      rm -f "$RUN_DIR/cloudflared.pid"; ( tunnel_start ) || log "Tunnel restart failed, will retry."
    fi
  done
}
