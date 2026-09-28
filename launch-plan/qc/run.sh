#!/usr/bin/env bash
# QC for the website ↔ demo stitching. Builds the website, then runs the
# Playwright suite in launch-plan/qc against a fresh demo app and gateway
# (ports 8094 and 8097) and writes launch-plan/qc/REPORT.md.
#
#   ./launch-plan/qc/run.sh                  build the site if needed, run everything
#   ./launch-plan/qc/run.sh --rebuild        rebuild the site first
#   ./launch-plan/qc/run.sh --project desktop   any extra args go to Playwright
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../.." && pwd)"
site="$root/launch-plan/website"

rebuild=0
args=()
for a in "$@"; do
  case "$a" in
    --rebuild) rebuild=1 ;;
    *) args+=("$a") ;;
  esac
done

if [[ "$rebuild" == 1 || ! -f "$site/dist/index.html" ]]; then
  echo "[qc] building the website…"
  (cd "$site" && { [[ -d node_modules ]] || npm install --no-audit --no-fund; } && npm run build) >/dev/null
fi

cd "$root"
for port in 8094 8097; do
  if (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then
    echo "[qc] port $port is busy; stop whatever uses it first." >&2
    exit 1
  fi
done

echo "[qc] running Playwright (demo app :8094, gateway :8097)…"
npx playwright test --config launch-plan/qc/playwright.config.ts "${args[@]+"${args[@]}"}"
echo "[qc] report: launch-plan/qc/REPORT.md"
