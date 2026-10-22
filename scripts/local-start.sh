#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

for tool in node pnpm go docker caddy; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Missing $tool. Install the prerequisites listed in README.md, then retry." >&2
    exit 1
  fi
done
docker compose version >/dev/null
if [[ -n "${DOCKER_CONTEXT:-}" || -z "${DOCKER_HOST:-}" ]]; then
  docker_endpoint="$(docker context inspect --format '{{.Endpoints.docker.Host}}')"
else
  docker_endpoint="$DOCKER_HOST"
fi
case "$docker_endpoint" in
  unix://*|npipe://*|tcp://127.0.0.1:*|tcp://localhost:*) ;;
  *)
    echo "Local startup requires a local Docker context; remote Docker endpoints are refused." >&2
    exit 1
    ;;
esac

if ! docker info >/dev/null 2>&1; then
  if [[ "$(uname -s)" == Darwin && -d /Applications/Docker.app ]]; then
    echo "Starting Docker Desktop..."
    open -gja Docker
    for ((attempt = 0; attempt < 60; attempt++)); do
      if docker info >/dev/null 2>&1; then break; fi
      sleep 2
    done
  fi
  if ! docker info >/dev/null 2>&1; then
    echo "Docker daemon is unavailable. Start your local Docker engine, then retry." >&2
    exit 1
  fi
fi

pnpm install --frozen-lockfile
exec node scripts/local-audit-up.mjs --prepare
