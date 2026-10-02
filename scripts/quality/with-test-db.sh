#!/usr/bin/env bash
# Run a command against a throwaway PostgreSQL 17 (Docker) with the canonical
# schema; exports TEST_DATABASE_URL and removes the container afterwards.
# Usage: scripts/quality/with-test-db.sh scripts/quality/verify-go.sh
set -euo pipefail

[ "$#" -gt 0 ] || { echo "usage: with-test-db.sh <command> [args...]" >&2; exit 2; }
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

name="nihongo-test-db-$$"
docker run -d --rm --name "$name" -p 127.0.0.1::5432 \
  -e POSTGRES_DB=nihongo_bjt -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  postgres:17 >/dev/null
trap 'docker stop "$name" >/dev/null 2>&1 || true' EXIT

# TCP readiness inside the container: the entrypoint's init server is socket-only.
for _ in $(seq 1 120); do
  docker exec "$name" pg_isready -h 127.0.0.1 -U postgres -d nihongo_bjt -q && break
  sleep 0.5
done
docker exec "$name" pg_isready -h 127.0.0.1 -U postgres -d nihongo_bjt -q

port="$(docker port "$name" 5432/tcp | head -1 | sed 's/.*://')"
export TEST_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:$port/nihongo_bjt"
bash "$REPO_ROOT/scripts/quality/provision-test-schema.sh" "$TEST_DATABASE_URL"
"$@"
