#!/usr/bin/env bash
# Runs only against containers and a web checkout created by this invocation.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
tmp="$(mktemp -d "${TMPDIR:-/tmp}/img301-e2e.XXXXXXXX")"
tag="img301-$(basename "$tmp" | tr '[:upper:]' '[:lower:]')"
pids=()
cleanup() {
  local result=$?
  docker logs "$tag-api" >"$tmp/api.log" 2>&1 || :
  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || :; done
  for pid in "${pids[@]}"; do wait "$pid" 2>/dev/null || :; done
  docker stop "$tag-api" "$tag-pg" "$tag-redis" >/dev/null 2>&1 || :
  docker network rm "$tag-net" >/dev/null 2>&1 || :
  rm -f "$tmp/key.pem"
  echo "Disposable run logs retained at $tmp (exit $result)" >&2
}
trap cleanup EXIT
free_port() { python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()'; }
web_port="$(free_port)"; next_port="$(free_port)"; fixture_port="$(free_port)"
docker network create "$tag-net" >/dev/null
docker run -d --rm --network "$tag-net" --network-alias pg --name "$tag-pg" -p 127.0.0.1::5432 -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=disposable -e POSTGRES_DB=img301 postgres:17 >/dev/null
docker run -d --rm --network "$tag-net" --network-alias redis --name "$tag-redis" -p 127.0.0.1::6379 redis:8-alpine >/dev/null
for _ in $(seq 1 120); do
  if docker exec "$tag-pg" pg_isready -h 127.0.0.1 -U postgres -d img301 -q && docker exec "$tag-redis" redis-cli ping 2>/dev/null | grep -q PONG; then break; fi
  sleep 0.5
done
docker exec "$tag-pg" pg_isready -h 127.0.0.1 -U postgres -d img301 -q
docker exec "$tag-redis" redis-cli ping | grep -q PONG
pg_port="$(docker port "$tag-pg" 5432/tcp | head -1 | sed 's/.*://')"
redis_port="$(docker port "$tag-redis" 6379/tcp | head -1 | sed 's/.*://')"
export IMG301_DATABASE_URL="postgresql://postgres:disposable@127.0.0.1:$pg_port/img301"
bash "$root/scripts/quality/provision-test-schema.sh" "$IMG301_DATABASE_URL"
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj '/CN=api.unsplash.com' -addext 'subjectAltName=DNS:api.unsplash.com' -keyout "$tmp/key.pem" -out "$tmp/cert.pem" >/dev/null 2>&1
FIXTURE_KEY="$tmp/key.pem" FIXTURE_CERT="$tmp/cert.pem" FIXTURE_PORT="$fixture_port" node "$root/e2e/img-301/provider.mjs" >"$tmp/provider.log" 2>&1 & pids+=("$!")
(cd "$root/apps/api-go" && CGO_ENABLED=0 GOOS=linux go build -o "$tmp/api" ./cmd/api)
mkdir -p "$tmp/media" "$tmp/work/apps/web"
rsync -a --exclude node_modules --exclude .next --exclude '.env*' "$root/apps/web/" "$tmp/work/apps/web/"
cp "$root/tsconfig.json" "$tmp/work/tsconfig.json"
ln -s "$root/node_modules" "$tmp/work/node_modules"
ln -s "$root/packages" "$tmp/work/packages"
ln -s "$root/apps/web/node_modules" "$tmp/work/apps/web/node_modules"
docker run -d --rm --network "$tag-net" --name "$tag-api" -p 127.0.0.1::4001 -v "$tmp:/fixture" \
  -e DATABASE_URL='postgresql://postgres:disposable@pg:5432/img301' -e REDIS_URL='redis://redis:6379' \
  -e API_GO_PORT=4001 -e CORS_ORIGINS="http://127.0.0.1:$web_port" -e COOKIE_SECURE=false \
  -e MEDIA_BASE_PATH=/fixture/media -e IMAGE_SELECTION_SIGNING_KEY=disposable-test-signing-key-32-bytes \
  -e UNSPLASH_ACCESS_KEY=fixture-key -e HTTPS_PROXY="http://host.docker.internal:$fixture_port" \
  -e SSL_CERT_FILE=/fixture/cert.pem postgres:17 /fixture/api >/dev/null
api_port="$(docker port "$tag-api" 4001/tcp | head -1 | sed 's/.*://')"
export IMG301_WEB_URL="http://127.0.0.1:$web_port" IMG301_API_URL="http://127.0.0.1:$api_port"
export IMG301_OUTPUT_DIR="$tmp/results"
(cd "$tmp/work/apps/web" && exec env -i PATH="$PATH" HOME="$HOME" API_URL="$IMG301_API_URL" NEXT_PUBLIC_API_URL="$IMG301_WEB_URL" "$root/node_modules/.bin/next" dev --webpack --hostname 127.0.0.1 --port "$next_port") >"$tmp/web.log" 2>&1 & pids+=("$!")
IMG301_API_PORT="$api_port" IMG301_NEXT_PORT="$next_port" IMG301_PROXY_PORT="$web_port" node "$root/e2e/img-301/proxy.mjs" >"$tmp/proxy.log" 2>&1 & pids+=("$!")
for _ in $(seq 1 120); do
  if curl -fsS "$IMG301_API_URL/health/live" >/dev/null 2>&1 && curl -fsS "$IMG301_WEB_URL/en/register" >/dev/null 2>&1; then break; fi
  sleep 1
done
if ! curl -fsS "$IMG301_API_URL/health/live" >/dev/null || ! curl -fsS "$IMG301_WEB_URL/en/register" >/dev/null; then
  echo 'Isolated API or web failed to start; sanitized logs follow.' >&2
  docker logs "$tag-api" >&2
  cat "$tmp/web.log" >&2
  exit 1
fi
cd "$root"
pnpm exec playwright test --config e2e/img-301/playwright.config.ts 2>&1 | tee "$tmp/playwright.log"
