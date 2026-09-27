#!/usr/bin/env bash
# Sourced by the other scripts. Resolves paths and loads launch-plan/.env.local.
# Never prints secret values.

LAUNCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export LAUNCH_DIR

if [[ -f "$LAUNCH_DIR/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$LAUNCH_DIR/.env.local"
  set +a
fi

export APP_PORT="${APP_PORT:-8090}"
export GATEWAY_PORT="${GATEWAY_PORT:-8099}"
export APP_MODE="${APP_MODE:-preview}"
export APP_DIR="${APP_DIR:-..}"
export DEMO_DEFAULT_ROLE="${DEMO_DEFAULT_ROLE:-owner}"
export NGROK_DOMAIN="${NGROK_DOMAIN:-}"
# Strip a pasted scheme or trailing slash from the domain.
NGROK_DOMAIN="${NGROK_DOMAIN#https://}"
NGROK_DOMAIN="${NGROK_DOMAIN#http://}"
NGROK_DOMAIN="${NGROK_DOMAIN%/}"
export NGROK_DOMAIN

APP_ROOT="$(cd "$LAUNCH_DIR/$APP_DIR" && pwd)"
export APP_ROOT
RUN_DIR="$LAUNCH_DIR/.run"
export RUN_DIR
mkdir -p "$RUN_DIR/logs"

if [[ -n "$NGROK_DOMAIN" ]]; then
  export PUBLIC_URL="https://$NGROK_DOMAIN"
else
  export PUBLIC_URL="http://localhost:$GATEWAY_PORT"
fi

log() { printf '\033[1;33m[launch]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[launch]\033[0m %s\n' "$*" >&2; exit 1; }

port_free() {
  ! (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
}

wait_for_port() {
  local port="$1" name="$2" tries="${3:-120}"
  for ((i = 0; i < tries; i++)); do
    if ! port_free "$port"; then return 0; fi
    sleep 1
  done
  die "$name did not start on port $port (see $RUN_DIR/logs)."
}
