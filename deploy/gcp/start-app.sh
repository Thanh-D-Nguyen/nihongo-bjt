#!/usr/bin/env bash
set -euo pipefail

cd /home/deploy/nihongo-bjt
set -a
. ./.env
set +a

exec pnpm --filter "$1" start
