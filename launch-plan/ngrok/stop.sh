#!/usr/bin/env bash
# Stop everything started by start-public.sh / start-demo.sh --background.
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../scripts" && pwd)/load-env.sh"

for name in ngrok gateway app; do
  pidfile="$RUN_DIR/$name.pid"
  [[ -f "$pidfile" ]] || continue
  pid="$(cat "$pidfile")"
  if kill -0 "$pid" 2>/dev/null; then
    # Stop the process and its children (npx -> vite).
    pkill -TERM -P "$pid" 2>/dev/null || true
    kill -TERM "$pid" 2>/dev/null || true
    log "Stopped $name ($pid)"
  fi
  rm -f "$pidfile"
done
rm -f "$RUN_DIR/traffic-policy.yml" "$RUN_DIR/public-url"
