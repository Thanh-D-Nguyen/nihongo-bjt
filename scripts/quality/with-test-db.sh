#!/usr/bin/env bash
# Run a command against throwaway PostgreSQL 17 and Redis (Docker) with the
# canonical schema; exports TEST_DATABASE_URL and TEST_REDIS_URL (matching the
# CI services, so Redis integration tests never skip) and removes the
# containers afterwards. An already-set TEST_REDIS_URL is kept.
# Usage: scripts/quality/with-test-db.sh scripts/quality/verify-go.sh
set -euo pipefail

[ "$#" -gt 0 ] || { echo "usage: with-test-db.sh <command> [args...]" >&2; exit 2; }
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

name="nihongo-test-db-$$"
docker run -d --rm --name "$name" -p 127.0.0.1::5432 \
  -e POSTGRES_DB=nihongo_bjt -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  postgres:17 >/dev/null
redis_name="nihongo-test-redis-$$"
cleanup() {
  local container
  for container in "$name" "$redis_name"; do
    docker stop "$container" >/dev/null 2>&1 || echo "with-test-db: $container was already stopped" >&2
  done
}
trap cleanup EXIT

if [ -z "${TEST_REDIS_URL:-}" ]; then
  docker run -d --rm --name "$redis_name" -p 127.0.0.1::6379 redis:8-alpine >/dev/null
  for _ in $(seq 1 60); do
    docker exec "$redis_name" redis-cli ping 2>/dev/null | grep -q PONG && break
    sleep 0.5
  done
  docker exec "$redis_name" redis-cli ping | grep -q PONG
  redis_port="$(docker port "$redis_name" 6379/tcp | head -1 | sed 's/.*://')"
  export TEST_REDIS_URL="redis://127.0.0.1:$redis_port"
fi

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
