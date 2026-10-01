#!/usr/bin/env bash
# Put SQINOS on https://$PUBLIC_DOMAIN from this Mac through a Cloudflare Tunnel:
#
#   website (static build) ┐
#                          ├─> gateway :$GATEWAY_PORT ──> cloudflared ──> https://$PUBLIC_DOMAIN
#   demo app :$APP_PORT    ┘
#
# Usage:
#   ./launch-plan/cloudflare/start-public.sh              start everything
#   ./launch-plan/cloudflare/start-public.sh --rebuild    rebuild the website first
#   ./launch-plan/cloudflare/start-public.sh --local      no tunnel (gateway only)
#
# Run it inside tmux so closing the terminal does not stop the site:
#   tmux new -s sqinos
#   caffeinate -dims ./launch-plan/cloudflare/start-public.sh
#
# Ctrl-C stops everything this script started. Later edits: redeploy.sh.
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

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
(( $(node_major) >= 22 )) || die "Node $(node -v) found, 22+ needed (brew install node@22)."
[[ -f "$APP_ROOT/package.json" ]] || die "No app found at $APP_ROOT (check APP_DIR in .env.local)."
if [[ "$local_only" == 0 ]]; then
  command -v cloudflared >/dev/null || die "cloudflared is not installed. Run: brew install cloudflared"
  [[ -n "$PUBLIC_DOMAIN" ]] || die "PUBLIC_DOMAIN is empty in launch-plan/.env.local."
fi
for p in "$APP_PORT" "$GATEWAY_PORT"; do
  port_free "$p" || die "Port $p is busy. Run ./launch-plan/cloudflare/stop.sh or change the port in .env.local."
done

stopping=0
cleanup() {
  (( stopping )) && return
  stopping=1
  log "Stopping…"
  "$CF_DIR/stop.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT
trap 'cleanup; exit 0' INT TERM

# 1. Website: build when asked or when there is nothing to serve yet.
if [[ "$rebuild" == 1 || ! -f "$SITE_LIVE/index.html" ]]; then
  site_build
  site_publish
fi

# 2. Demo app: always rebuilt (DEMO, DEMO_SIGNIN_URL, DEMO_NOW are baked in).
app_build
app_start

# 3. Gateway
gateway_start

if [[ "$local_only" == 1 ]]; then
  log "Local only: open http://localhost:$GATEWAY_PORT  (Ctrl-C to stop)"
  supervise 0
fi

# 4. Tunnel
tunnel_start
if wait_public 45; then
  print_links
else
  log "The tunnel is running but https://$PUBLIC_DOMAIN/healthz did not answer yet."
  log "Usual causes: the Cloudflare zone is not Active yet, or the tunnel's public hostname is not set. See $RUN_DIR/logs/cloudflared.log"
  log "Leaving everything running; try again: curl -sI $PUBLIC_URL/healthz"
fi

supervise 1
