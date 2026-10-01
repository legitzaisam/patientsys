#!/usr/bin/env bash
# Stop everything started by cloudflare/start-public.sh (tunnel, gateway, app).
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
for name in cloudflared gateway app; do stop_named "$name"; done
rm -f "$RUN_DIR/public-url"
