#!/usr/bin/env bash
# One command to put Aetheria on the internet from this Mac:
#
#   website (static build)  ┐
#                           ├─> gateway :$GATEWAY_PORT ──> ngrok ──> https://$NGROK_DOMAIN
#   demo app :$APP_PORT     ┘
#
# Usage:
#   ./launch-plan/ngrok/start-public.sh              start everything
#   ./launch-plan/ngrok/start-public.sh --rebuild    rebuild the website first
#   ./launch-plan/ngrok/start-public.sh --local      skip ngrok (gateway only)
#
# Ctrl-C stops everything this script started.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../scripts" && pwd)/load-env.sh"

rebuild=0
local_only=0
for arg in "$@"; do
  case "$arg" in
    --rebuild) rebuild=1 ;;
    --local) local_only=1 ;;
    *) die "Unknown option: $arg" ;;
  esac
done

command -v node >/dev/null || die "Node.js 22+ is required."
if [[ "$local_only" == 0 ]]; then
  command -v ngrok >/dev/null || die "ngrok is not installed. Run: brew install ngrok"
  if [[ -z "${NGROK_AUTHTOKEN:-}" ]] && ! ngrok config check >/dev/null 2>&1; then
    die "No ngrok authtoken. Put NGROK_AUTHTOKEN in launch-plan/.env.local (see .env.example)."
  fi
fi
port_free "$GATEWAY_PORT" || die "Port $GATEWAY_PORT is busy. Run ./launch-plan/ngrok/stop.sh or change GATEWAY_PORT."

cleanup() {
  log "Stopping…"
  "$LAUNCH_DIR/ngrok/stop.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

# 1. Website -----------------------------------------------------------------
site="$LAUNCH_DIR/website"
if [[ "$rebuild" == 1 || ! -f "$site/dist/index.html" ]]; then
  log "Building the website…"
  (
    cd "$site"
    if [[ ! -d node_modules ]]; then npm install --no-audit --no-fund; fi
    npm run build
  ) >"$RUN_DIR/logs/website-build.log" 2>&1 || die "Website build failed, see $RUN_DIR/logs/website-build.log"
fi

# 2. Demo app ----------------------------------------------------------------
"$LAUNCH_DIR/ngrok/start-demo.sh" --background

# 3. Gateway -----------------------------------------------------------------
log "Starting the gateway on http://localhost:$GATEWAY_PORT"
GATEWAY_PORT="$GATEWAY_PORT" APP_PORT="$APP_PORT" WEBSITE_DIST="$site/dist" \
  DEMO_DEFAULT_ROLE="$DEMO_DEFAULT_ROLE" \
  nohup node "$LAUNCH_DIR/gateway/server.mjs" >"$RUN_DIR/logs/gateway.log" 2>&1 &
echo $! >"$RUN_DIR/gateway.pid"
wait_for_port "$GATEWAY_PORT" "The gateway" 30

if [[ "$local_only" == 1 ]]; then
  log "Local only: open http://localhost:$GATEWAY_PORT  (Ctrl-C to stop)"
  wait "$(cat "$RUN_DIR/gateway.pid")"
  exit 0
fi

# 4. ngrok -------------------------------------------------------------------
ngrok_args=(http "$GATEWAY_PORT" --log stdout --log-format logfmt)
if [[ -n "$NGROK_DOMAIN" ]]; then
  ngrok_args+=(--url "https://$NGROK_DOMAIN")
else
  log "NGROK_DOMAIN is empty: ngrok will assign a temporary URL. Set it in .env.local to keep one fixed address."
fi

if [[ -n "${NGROK_BASIC_AUTH_USER:-}" && -n "${NGROK_BASIC_AUTH_PASS:-}" ]]; then
  (( ${#NGROK_BASIC_AUTH_PASS} >= 8 && ${#NGROK_BASIC_AUTH_PASS} <= 128 )) \
    || die "NGROK_BASIC_AUTH_PASS must be 8 to 128 characters (ngrok rule)."
  policy="$RUN_DIR/traffic-policy.yml"
  umask 077
  cat >"$policy" <<YAML
on_http_request:
  - actions:
      - type: basic-auth
        config:
          credentials:
            - "${NGROK_BASIC_AUTH_USER}:${NGROK_BASIC_AUTH_PASS}"
YAML
  ngrok_args+=(--traffic-policy-file "$policy")
  log "Basic auth is on for the public URL."
fi

log "Opening the tunnel…"
ngrok "${ngrok_args[@]}" >"$RUN_DIR/logs/ngrok.log" 2>&1 &
echo $! >"$RUN_DIR/ngrok.pid"

# Read the public URL from the agent's local API.
public=""
for _ in $(seq 1 30); do
  public="$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | node -e '
    let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
      try { const t = JSON.parse(s).tunnels || []; const h = t.find(x => x.public_url.startsWith("https")); process.stdout.write(h ? h.public_url : ""); } catch { }
    });' || true)"
  [[ -n "$public" ]] && break
  sleep 1
done
[[ -n "$public" ]] || die "ngrok did not come up, see $RUN_DIR/logs/ngrok.log"
echo "$public" >"$RUN_DIR/public-url"

cat <<INFO

  Aetheria is public:

    Website        $public/
    Clinic demo    $public/demo/enter?role=owner
    Patient demo   $public/demo/enter?role=patient
    Staff sign-in  $public/auth
    ngrok inspector http://127.0.0.1:4040

  Logs: $RUN_DIR/logs     Ctrl-C to stop everything.

INFO

wait "$(cat "$RUN_DIR/ngrok.pid")"
