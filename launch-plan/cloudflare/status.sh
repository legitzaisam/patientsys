#!/usr/bin/env bash
# What is running, and does the public URL answer?
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
for name in app gateway cloudflared; do
  if pid_alive "$name"; then echo "  ✓ $name running (pid $(cat "$RUN_DIR/$name.pid"))"; else echo "  ✗ $name not running"; fi
done
echo "  app      http://127.0.0.1:$APP_PORT/auth      -> $(curl -s -o /dev/null -m 5 -w '%{http_code}' "http://127.0.0.1:$APP_PORT/auth" || echo 000)"
echo "  gateway  http://127.0.0.1:$GATEWAY_PORT/healthz -> $(curl -s -o /dev/null -m 5 -w '%{http_code}' "http://127.0.0.1:$GATEWAY_PORT/healthz" || echo 000)"
if [[ -n "$PUBLIC_DOMAIN" ]]; then
  echo "  public   $PUBLIC_URL/healthz -> $(curl -s -o /dev/null -m 8 -w '%{http_code}' "$PUBLIC_URL/healthz" || echo 000)"
  echo "  apex     http://${PUBLIC_DOMAIN#www.}/ -> $(curl -s -o /dev/null -m 8 -w '%{http_code} %{redirect_url}' "http://${PUBLIC_DOMAIN#www.}/" || echo 000)"
fi
[[ -d "$APP_LIVE" ]] && echo "  app snapshot built $(date -r "$APP_LIVE" '+%Y-%m-%d %H:%M' 2>/dev/null)"
[[ -d "$SITE_LIVE" ]] && echo "  website snapshot built $(date -r "$SITE_LIVE" '+%Y-%m-%d %H:%M' 2>/dev/null)"
