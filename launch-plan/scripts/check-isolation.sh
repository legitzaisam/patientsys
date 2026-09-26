#!/usr/bin/env bash
# Fails if the working tree has any change outside launch-plan/.
# Run from anywhere:  ./launch-plan/scripts/check-isolation.sh
set -euo pipefail

root="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
branch="$(git -C "$root" rev-parse --abbrev-ref HEAD)"

outside="$(git -C "$root" status --porcelain --untracked-files=all | awk '{ $1=""; sub(/^ /, ""); print }' | grep -v '^launch-plan/' || true)"

echo "Repository: $root"
echo "Branch:     $branch"

if [[ -n "$outside" ]]; then
  echo
  echo "FAIL: changes outside launch-plan/:"
  echo "$outside" | sed 's/^/  /'
  exit 1
fi

echo "OK: every change is inside launch-plan/."
