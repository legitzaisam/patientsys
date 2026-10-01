#!/usr/bin/env bash
# Stop the local stack from cloudflare/start-local.sh (gateway :8199, app :8190).
# The public stack on 8090/8099 and the tunnel are left alone.
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
export RUN_DIR="$RUN_DIR/local"
for name in gateway app; do stop_named "$name"; done
