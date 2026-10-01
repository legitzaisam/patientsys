#!/usr/bin/env bash
# The whole of SQINOS on this Mac — website, clinic portal and patient portal
# behind one address — for trying a change before it goes public:
#
#   website build  ┐
#                  ├─> gateway :8199 ──> http://localhost:8199
#   demo app :8190 ┘
#
# It runs beside the public stack: own ports, own snapshots, logs and pid files
# under launch-plan/.run/local/, so starting or stopping it never disturbs
# www.sqinos.com on 8090/8099.
#
#   ./launch-plan/cloudflare/start-local.sh   build from the working tree, then start
#   ./launch-plan/cloudflare/stop-local.sh    stop it again
#
# Both builds come from the working tree, committed or not, and the app runs in
# demo mode (fixture clinic, no Supabase) exactly as the public one does.
# Re-run this script after an edit: it rebuilds and replaces what is running.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

# Set after lib.sh, so .env.local cannot pull the public ports or the public
# pid files in here. LOCAL_URL is what the app and the website are built with.
export APP_PORT=8190
export GATEWAY_PORT=8199
export RUN_DIR="$RUN_DIR/local"
export PUBLIC_URL="http://localhost:$GATEWAY_PORT"
export APP_LIVE="$RUN_DIR/app-live" APP_NEXT="$RUN_DIR/app-next"
export SITE_LIVE="$RUN_DIR/website-live" SITE_NEXT="$RUN_DIR/website-next"
[[ "$RUN_DIR" == */.run/local && "$APP_PORT" != 8090 && "$GATEWAY_PORT" != 8099 ]] \
  || die "This would use the public stack's ports or pid files. Refusing."
mkdir -p "$RUN_DIR/logs"

command -v node >/dev/null || die "Node.js 22+ is required."
(( $(node_major) >= 22 )) || die "Node $(node -v) found, 22+ needed (brew install node@22)."
[[ -f "$APP_ROOT/package.json" ]] || die "No app found at $APP_ROOT (check APP_DIR in .env.local)."

# A second run replaces the first; stop_named only ever reads our own pid files.
for name in gateway app; do stop_named "$name"; done
for p in "$APP_PORT" "$GATEWAY_PORT"; do
  port_free "$p" || die "Port $p is busy (lsof -nP -iTCP:$p -sTCP:LISTEN names it)."
done

site_build
site_publish
app_build
app_start
gateway_start

code() { curl -s -o /dev/null -m 10 -w '%{http_code}' "$1" || echo 000; }
log "gateway  $PUBLIC_URL/healthz -> $(code "$PUBLIC_URL/healthz")"
log "website  $PUBLIC_URL/ -> $(code "$PUBLIC_URL/")"
log "portals  /dashboard -> $(code "$PUBLIC_URL/dashboard")   /my-record -> $(code "$PUBLIC_URL/my-record")"
cat <<INFO

  SQINOS is running locally:

    Website        $PUBLIC_URL/
    Sign in        $PUBLIC_URL/login
    Clinic portal  $PUBLIC_URL/demo/enter?role=owner
    Patient portal $PUBLIC_URL/demo/enter?role=patient

  Logs: $RUN_DIR/logs     Stop: ./launch-plan/cloudflare/stop-local.sh

INFO
