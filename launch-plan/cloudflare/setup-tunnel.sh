#!/usr/bin/env bash
# One-time tunnel set-up on the Mac (locally-managed Cloudflare Tunnel, no Zero Trust plan needed):
#   1. cloudflared tunnel login        -> opens the browser once; pick sqinos.com, Authorize
#   2. cloudflared tunnel create NAME  -> credentials in ~/.cloudflared/<UUID>.json
#   3. writes ~/.cloudflared/NAME.yml  -> ingress: www + apex -> http://localhost:$GATEWAY_PORT
#   4. validates it, then creates the two proxied CNAME records in the Cloudflare zone
#
#   ./launch-plan/cloudflare/setup-tunnel.sh
#
# Safe to rerun: it reuses an existing tunnel and config, and only (re)writes DNS.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

command -v cloudflared >/dev/null || die "cloudflared is not installed. Run: brew install cloudflared"
[[ -n "$PUBLIC_DOMAIN" ]] || die "PUBLIC_DOMAIN is empty in launch-plan/.env.local."
[[ -z "$TUNNEL_TOKEN" ]] || die "TUNNEL_TOKEN is set: this script is for the config-file (locally-managed) path. Clear it or skip this script."

apex="${PUBLIC_DOMAIN#www.}"
cfg="${CLOUDFLARED_CONFIG/#\~/$HOME}"
cfdir="$HOME/.cloudflared"
mkdir -p "$cfdir"

# 1. Account certificate (browser login, once)
if [[ ! -f "$cfdir/cert.pem" ]]; then
  log "Logging cloudflared in: the browser opens, choose $apex and click Authorize."
  cloudflared tunnel login
  [[ -f "$cfdir/cert.pem" ]] || die "Login did not produce $cfdir/cert.pem"
else
  log "Account certificate present ($cfdir/cert.pem)."
fi

# 2. The tunnel (reuse if it exists)
tunnel_id() {
  cloudflared tunnel list --name "$TUNNEL_NAME" --output json 2>/dev/null \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const t=JSON.parse(s);process.stdout.write(t&&t[0]?t[0].id:"")}catch{}})'
}
id="$(tunnel_id || true)"
if [[ -z "$id" ]]; then
  log "Creating tunnel \"$TUNNEL_NAME\"…"
  cloudflared tunnel create "$TUNNEL_NAME"
  id="$(tunnel_id || true)"
fi
[[ -n "$id" ]] || die "Could not find or create tunnel \"$TUNNEL_NAME\" (cloudflared tunnel list)."
[[ -f "$cfdir/$id.json" ]] || die "Credentials file $cfdir/$id.json is missing. If the tunnel was created on another machine, delete it (cloudflared tunnel delete $TUNNEL_NAME) and rerun."
log "Tunnel $TUNNEL_NAME = $id"

# 3. Config file (outside the repo)
umask 077
cat >"$cfg" <<YAML
# Written by launch-plan/cloudflare/setup-tunnel.sh — the gateway on :$GATEWAY_PORT serves everything.
tunnel: $id
credentials-file: $cfdir/$id.json
ingress:
  - hostname: $PUBLIC_DOMAIN
    service: http://localhost:$GATEWAY_PORT
  - hostname: $apex
    service: http://localhost:$GATEWAY_PORT
  - service: http_status:404
YAML
log "Wrote $cfg"
cloudflared tunnel --config "$cfg" ingress validate

# 4. DNS: proxied CNAMEs to <id>.cfargotunnel.com (the zone must be Active on Cloudflare)
for host in "$PUBLIC_DOMAIN" "$apex"; do
  log "Routing $host -> tunnel"
  cloudflared tunnel route dns --overwrite-dns "$TUNNEL_NAME" "$host"
done

cat <<INFO

  Tunnel ready.
    name     $TUNNEL_NAME
    id       $id
    config   $cfg
    DNS      $PUBLIC_DOMAIN and $apex -> $id.cfargotunnel.com (proxied)

  Next:
    ./launch-plan/cloudflare/doctor.sh
    tmux new -s sqinos
    caffeinate -dims ./launch-plan/cloudflare/start-public.sh

INFO
