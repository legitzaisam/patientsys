#!/usr/bin/env bash
# Start the Aetheria app in DEMO mode on $APP_PORT (default 8090).
#
# - Demo mode only: fixture clinic, sandboxed email/SMS, no live Supabase.
# - The app runs unmodified. The ngrok host is allowed through Vite's
#   __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS variable instead of editing
#   vite.config.ts.
# - Never touches your `npm run dev` on 8080.
#
# Usage:  ./launch-plan/ngrok/start-demo.sh            (foreground)
#         ./launch-plan/ngrok/start-demo.sh --background
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../scripts" && pwd)/load-env.sh"

background=0
[[ "${1:-}" == "--background" ]] && background=1

[[ -f "$APP_ROOT/package.json" ]] || die "No app found at $APP_ROOT (check APP_DIR in .env.local)."
port_free "$APP_PORT" || die "Port $APP_PORT is busy. Stop whatever uses it or change APP_PORT."

cd "$APP_ROOT"

# Install only when missing. Never reinstall over an existing node_modules,
# so running this from a checkout you develop in cannot disturb it.
if [[ ! -d node_modules ]]; then
  log "Installing app dependencies (first run only)…"
  npm ci --no-audit --no-fund
fi

export DEMO=1
export DEMO_NOW="${DEMO_NOW:-}"
export APP_ORIGIN="$PUBLIC_URL"
export __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=".ngrok-free.dev,.ngrok-free.app,.ngrok.app,.ngrok.dev${NGROK_DOMAIN:+,$NGROK_DOMAIN}"

# Demo mode never talks to Supabase, but the browser client module still wants
# a URL and key to exist. Placeholders keep secrets out of the worktree; a real
# .env, if present, is left alone.
if [[ ! -f "$APP_ROOT/.env" ]]; then
  export VITE_SUPABASE_URL="https://demo.invalid"
  export VITE_SUPABASE_PUBLISHABLE_KEY="demo-placeholder-key"
  export VITE_SUPABASE_PROJECT_ID="demo"
  export SUPABASE_URL="https://demo.invalid"
  export SUPABASE_PUBLISHABLE_KEY="demo-placeholder-key"
fi

logfile="$RUN_DIR/logs/app.log"

start_dev() {
  local cmd=(npx vite dev --port "$APP_PORT" --strictPort --host 127.0.0.1)
  log "Starting the demo app (dev) on http://localhost:$APP_PORT"
  if [[ "$background" == 1 ]]; then
    nohup "${cmd[@]}" >"$logfile" 2>&1 &
    echo $! >"$RUN_DIR/app.pid"
    wait_for_port "$APP_PORT" "The demo app" 180
    log "Demo app is up (log: $logfile)."
  else
    exec "${cmd[@]}"
  fi
}

# preview: a production build. About 55 requests per page load instead of
# about 430 in dev mode, which matters on ngrok's free plan (20k requests a
# month). If the build or its first page fails, fall back to dev.
start_preview() {
  log "Building the app in demo mode (production build)…"
  if ! NITRO_PRESET=node-server npx vite build --config "$LAUNCH_DIR/ngrok/vite.demo.config.ts" \
      >"$RUN_DIR/logs/app-build.log" 2>&1; then
    log "Build failed (see $RUN_DIR/logs/app-build.log). Falling back to dev mode."
    return 1
  fi
  log "Starting the demo app (preview) on http://localhost:$APP_PORT"
  PORT="$APP_PORT" HOST=127.0.0.1 nohup node "$APP_ROOT/.output/server/index.mjs" >"$logfile" 2>&1 &
  local pid=$!
  echo "$pid" >"$RUN_DIR/app.pid"
  wait_for_port "$APP_PORT" "The demo app" 60
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$APP_PORT/auth" || echo 000)
  if [[ "$code" != 200 ]]; then
    log "The production build answered $code on /auth (see $logfile). Falling back to dev mode."
    kill "$pid" 2>/dev/null || true
    rm -f "$RUN_DIR/app.pid"
    sleep 1
    return 1
  fi
  log "Demo app is up (log: $logfile)."
  if [[ "$background" != 1 ]]; then
    trap 'kill "$pid" 2>/dev/null' EXIT INT TERM
    wait "$pid"
  fi
}

if [[ "$APP_MODE" == "preview" ]]; then
  start_preview || start_dev
else
  start_dev
fi
