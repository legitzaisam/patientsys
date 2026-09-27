#!/usr/bin/env bash
# Check that everything start-public.sh needs is in place. Changes nothing.
#   ./launch-plan/ngrok/doctor.sh
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../scripts" && pwd)/load-env.sh"

ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$*"; fail=1; }
fail=0

echo "Aetheria launch: pre-flight"

# Tools
if command -v node >/dev/null; then
  major="$(node -p 'process.versions.node.split(".")[0]')"
  (( major >= 22 )) && ok "Node $(node -v)" || bad "Node $(node -v) found, 22+ needed"
else bad "Node.js not found"; fi
if command -v ngrok >/dev/null; then ok "ngrok $(ngrok version 2>/dev/null | awk '{print $3}')"
else bad "ngrok not installed (brew install ngrok)"; fi

# Settings
[[ -f "$LAUNCH_DIR/.env.local" ]] && ok ".env.local present" || warn "No launch-plan/.env.local yet (cp .env.example .env.local)"
if [[ -n "${NGROK_AUTHTOKEN:-}" ]]; then ok "NGROK_AUTHTOKEN set (${#NGROK_AUTHTOKEN} chars)"
elif command -v ngrok >/dev/null && ngrok config check >/dev/null 2>&1 && grep -q authtoken "$(ngrok config check 2>/dev/null | awk '{print $NF}')" 2>/dev/null; then
  ok "Authtoken found in your ngrok config"
else bad "NGROK_AUTHTOKEN is empty"; fi
if [[ -n "$NGROK_DOMAIN" ]]; then
  [[ "$NGROK_DOMAIN" =~ \.ngrok(-free)?\.(dev|app)$ ]] && ok "NGROK_DOMAIN $NGROK_DOMAIN" \
    || warn "NGROK_DOMAIN $NGROK_DOMAIN is not an ngrok domain (fine if it is your own, reserved in ngrok)"
else warn "NGROK_DOMAIN empty: ngrok will pick the URL"; fi
if [[ -n "${NGROK_BASIC_AUTH_USER:-}${NGROK_BASIC_AUTH_PASS:-}" ]]; then
  if [[ -n "${NGROK_BASIC_AUTH_USER:-}" && ${#NGROK_BASIC_AUTH_PASS} -ge 8 ]]; then ok "Basic auth on"
  else bad "Basic auth needs both user and a password of 8+ characters"; fi
fi
ok "APP_MODE=$APP_MODE, app :$APP_PORT, gateway :$GATEWAY_PORT"

# App and website
[[ -f "$APP_ROOT/package.json" ]] && ok "App at $APP_ROOT" || bad "No app at $APP_ROOT (APP_DIR)"
[[ -d "$APP_ROOT/node_modules" ]] && ok "App dependencies installed" || warn "App dependencies missing (first start installs them)"
[[ -f "$LAUNCH_DIR/website/dist/index.html" ]] && ok "Website built" || warn "Website not built (first start builds it)"

# Ports
for p in "$APP_PORT" "$GATEWAY_PORT"; do
  port_free "$p" && ok "Port $p free" || warn "Port $p busy (run ngrok/stop.sh if it is ours)"
done

# Git isolation
if git -C "$LAUNCH_DIR" rev-parse >/dev/null 2>&1; then
  "$LAUNCH_DIR/scripts/check-isolation.sh" >/dev/null 2>&1 && ok "Only launch-plan/ has changes" \
    || warn "Changes outside launch-plan/ (run scripts/check-isolation.sh)"
fi

(( fail == 0 )) && echo "Ready: ./launch-plan/ngrok/start-public.sh" || { echo "Fix the ✗ items first."; exit 1; }
