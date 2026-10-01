#!/usr/bin/env bash
# Pre-flight for cloudflare/start-public.sh. Changes nothing.
#   ./launch-plan/cloudflare/doctor.sh
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$*"; fail=1; }
fail=0

echo "SQINOS launch (Cloudflare Tunnel): pre-flight"

# Tools
if command -v node >/dev/null; then
  (( $(node_major) >= 22 )) && ok "Node $(node -v)" || bad "Node $(node -v) found, 22+ needed (brew install node@22)"
else bad "Node.js not found"; fi
if command -v cloudflared >/dev/null; then ok "cloudflared $(cloudflared --version 2>/dev/null | awk '{print $3}')"
else bad "cloudflared not installed (brew install cloudflared)"; fi
command -v tmux >/dev/null && ok "tmux installed" || warn "tmux not installed (brew install tmux) — recommended so the site survives a closed terminal"

# Settings
[[ -f "$LAUNCH_DIR/.env.local" ]] && ok ".env.local present" || bad "No launch-plan/.env.local (cp .env.example .env.local)"
[[ -n "$PUBLIC_DOMAIN" ]] && ok "PUBLIC_DOMAIN $PUBLIC_DOMAIN" || bad "PUBLIC_DOMAIN is empty"
if [[ -n "$TUNNEL_TOKEN" ]]; then ok "TUNNEL_TOKEN set (${#TUNNEL_TOKEN} chars, remotely-managed tunnel)"
else
  cfg="${CLOUDFLARED_CONFIG/#\~/$HOME}"
  if [[ -f "$cfg" ]]; then
    if command -v cloudflared >/dev/null && cloudflared tunnel --config "$cfg" ingress validate >/dev/null 2>&1; then ok "Tunnel config $cfg validates (tunnel $TUNNEL_NAME)"
    else bad "Tunnel config $cfg does not validate: cloudflared tunnel --config $cfg ingress validate"; fi
  else bad "No TUNNEL_TOKEN and no tunnel config at $cfg"; fi
fi
ok "APP_MODE=preview (always, on this path), app :$APP_PORT, gateway :$GATEWAY_PORT, APP_ORIGIN=$PUBLIC_URL"
[[ "${DEMO_SIGNIN_URL-/login}" == "/login" && "${DEMO_SIGNIN_REDIRECT:-true}" != "false" ]] \
  && ok "Demo sign-in hand-off: DEMO_SIGNIN_URL=/login, DEMO_SIGNIN_REDIRECT on" \
  || warn "DEMO_SIGNIN_URL=${DEMO_SIGNIN_URL-} / DEMO_SIGNIN_REDIRECT=${DEMO_SIGNIN_REDIRECT-}: both must change together (README)"

# Secrets safety
if [[ -f "$APP_ROOT/.env" ]]; then
  if [[ "${VITE_SUPABASE_URL:-}" == "https://demo.invalid" && -n "${VITE_SUPABASE_PUBLISHABLE_KEY:-}" && "${SUPABASE_URL:-}" == "https://demo.invalid" ]]; then
    ok "Repo .env exists and the VITE_SUPABASE_* placeholders in .env.local override it"
  else
    bad "Repo .env holds live Supabase keys and .env.local does not set the placeholders (see .env.example, 'Public demo safety')"
  fi
else ok "No repo .env: placeholders are used automatically"; fi

# DNS
if command -v dig >/dev/null && [[ -n "$PUBLIC_DOMAIN" ]]; then
  apex="${PUBLIC_DOMAIN#www.}"
  ns="$(dig +short NS "$apex" 2>/dev/null | grep -v '^;;' | tr '\n' ' ')"
  if [[ "$ns" == *cloudflare.com* ]]; then ok "Nameservers for $apex are Cloudflare's ($ns)"
  else warn "Nameservers for $apex: ${ns:-none yet} — not Cloudflare's yet (Phase 2 of the plan)"; fi
  a="$(dig +short "$PUBLIC_DOMAIN" 2>/dev/null | grep -v '^;;' | tr '\n' ' ')"
  [[ -n "$a" ]] && ok "$PUBLIC_DOMAIN resolves ($a)" || warn "$PUBLIC_DOMAIN does not resolve yet (tunnel public hostname / DNS record missing)"
fi

# App and website
[[ -f "$APP_ROOT/package.json" ]] && ok "App at $APP_ROOT" || bad "No app at $APP_ROOT (APP_DIR)"
[[ -d "$APP_ROOT/node_modules" ]] && ok "App dependencies installed" || warn "App dependencies missing (first start installs them)"
[[ -d "$SITE_DIR/node_modules" ]] && ok "Website dependencies installed" || warn "Website dependencies missing (first start installs them)"
[[ -f "$SITE_LIVE/index.html" ]] && ok "Website snapshot present" || warn "No website snapshot yet (first start builds it)"

# Ports
for p in "$APP_PORT" "$GATEWAY_PORT"; do
  port_free "$p" && ok "Port $p free" || warn "Port $p busy (run cloudflare/stop.sh if it is ours)"
done

# Git isolation
if git -C "$LAUNCH_DIR" rev-parse >/dev/null 2>&1; then
  "$LAUNCH_DIR/scripts/check-isolation.sh" >/dev/null 2>&1 && ok "Only launch-plan/ has changes" \
    || warn "Changes outside launch-plan/ (run scripts/check-isolation.sh; fine if they are your own work in progress)"
fi

# Stitching QC
if [[ -f "$LAUNCH_DIR/qc/REPORT.md" ]]; then
  if grep -q 'Overall: \*\*passed\*\*' "$LAUNCH_DIR/qc/REPORT.md"; then
    ok "QC report passed ($(sed -n 's/^Run \([0-9-]* [0-9:]* UTC\).*/\1/p' "$LAUNCH_DIR/qc/REPORT.md")); rerun ./launch-plan/qc/run.sh after website or gateway edits"
  else warn "QC report has failures: read launch-plan/qc/REPORT.md, then rerun ./launch-plan/qc/run.sh"; fi
else warn "No QC report yet: run ./launch-plan/qc/run.sh once before going live"; fi

(( fail == 0 )) && echo "Ready: tmux new -s sqinos, then caffeinate -dims ./launch-plan/cloudflare/start-public.sh" || { echo "Fix the ✗ items first."; exit 1; }
