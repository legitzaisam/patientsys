#!/usr/bin/env bash
# Push an edit to the running public site without touching the tunnel.
#
#   ./launch-plan/cloudflare/redeploy.sh website   # edits under launch-plan/website/  (no restart, ~5 s)
#   ./launch-plan/cloudflare/redeploy.sh app       # edits under src/ (clinic or patient portal): rebuild + restart (~2 min build, ~3 s restart)
#   ./launch-plan/cloudflare/redeploy.sh all       # both
#   ./launch-plan/cloudflare/redeploy.sh tunnel    # restart only cloudflared (e.g. after a VPN/network change)
#
# The website is served from a snapshot that is swapped in one move, so visitors
# never see a half-built site. The app is rebuilt into a second snapshot while
# the old one keeps serving, then restarted: a few seconds of "not reachable",
# and the demo's in-memory data starts fresh (that is by design: fixtures).
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

what="${1:-}"
case "$what" in
  website|site)
    site_build
    site_publish
    ;;
  app|portal|portals)
    app_build
    app_stop
    app_start
    ;;
  all|both)
    site_build
    site_publish
    app_build
    app_stop
    app_start
    ;;
  tunnel)
    tunnel_stop
    tunnel_start
    wait_public 45 && log "Public URL answers again." || log "Public URL not answering yet; see $RUN_DIR/logs/cloudflared.log"
    ;;
  *)
    echo "Usage: $0 website | app | all | tunnel" >&2
    exit 2
    ;;
esac

if pid_alive gateway; then
  local_code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$GATEWAY_PORT/healthz" || echo 000)
  log "Gateway healthz: $local_code"
fi
if [[ -n "$PUBLIC_DOMAIN" ]] && pid_alive cloudflared; then
  public_code=$(curl -s -o /dev/null -m 8 -w '%{http_code}' "$PUBLIC_URL/healthz" || echo 000)
  log "Public healthz: $public_code  ($PUBLIC_URL)"
fi
log "Done: $what redeployed."
