#!/usr/bin/env bash
set -euo pipefail

cd /home/deploy/nihongo-bjt
EXPECTED_NODE_VERSION="$(tr -d '[:space:]' < .node-version)"
ACTUAL_NODE_VERSION="$(node --version | sed 's/^v//')"
if [ "$ACTUAL_NODE_VERSION" != "$EXPECTED_NODE_VERSION" ]; then
  printf 'Node.js %s is required, but the VM is running %s.\n' "$EXPECTED_NODE_VERSION" "$ACTUAL_NODE_VERSION" >&2
  exit 1
fi

set -a
. ./.env
set +a

exec pnpm --filter "$1" start
