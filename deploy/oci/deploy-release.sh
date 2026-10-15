#!/usr/bin/env bash
set -euo pipefail
source_root="$(git rev-parse --show-toplevel)"
cd "$source_root"
: "${DEPLOY_SHA:?validated commit required}"
: "${OCI_PUBLIC_HOST:?public hostname required}"
[[ "$DEPLOY_SHA" =~ ^[0-9a-f]{40}$ ]]
[[ "$OCI_PUBLIC_HOST" =~ ^[a-zA-Z0-9.-]+$ ]]
test "$(git rev-parse HEAD)" = "$DEPLOY_SHA"
bash scripts/quality/verify-ci-passed.sh "$DEPLOY_SHA"
base=/srv/kotobawork
export OCI_ENV_FILE="$base/deploy/oci/.env.production"
export OCI_RELEASE_SHA="$DEPLOY_SHA"
export OCI_SOURCE_DIR="$base/releases/$DEPLOY_SHA"
test -r "$OCI_ENV_FILE"
mountpoint -q "$base/data"
install -d -m 700 "$base/data/backups/releases"
install -d "$base/releases" "$base/runtime" "$base/deploy/oci"
exec 9>"$base/runtime/deploy.lock"
flock -n 9
# A slower CI run must never downgrade a newer push on main.
latest_sha="$(gh api "repos/$GITHUB_REPOSITORY/git/ref/heads/main" --jq .object.sha)"
if [ "$latest_sha" != "$DEPLOY_SHA" ]; then
  printf 'Superseded release %s; main is %s. No deployment performed.\n' "$DEPLOY_SHA" "$latest_sha"
  exit 0
fi
# An imported database without Prisma history must be baselined by the reviewed
# operator procedure (docs/deployment/oci.md) before any automatic release.
baseline_state="$(docker exec -u postgres oci-postgres-1 psql -U postgres -d nihongo_bjt -Atq -c \
  "SELECT CASE WHEN to_regclass('content._prisma_migrations') IS NOT NULL THEN 'ready' WHEN NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'content') THEN 'ready' ELSE 'unbaselined' END")"
if [ "$baseline_state" != ready ]; then
  printf 'Refusing release %s: production database has no Prisma migration history. Complete the baseline procedure in docs/deployment/oci.md first. No production changes made.\n' "$DEPLOY_SHA" >&2
  exit 3
fi
install -d "$OCI_SOURCE_DIR"
git archive "$DEPLOY_SHA" | tar -x -C "$OCI_SOURCE_DIR"
compose=(docker compose --project-name oci --env-file "$OCI_ENV_FILE" -f "$OCI_SOURCE_DIR/deploy/oci/docker-compose.oci.yml")
"${compose[@]}" config --quiet
# Pin running images before rebuilding, so rollback never resolves mutable tags.
rollback="$base/runtime/rollback-$DEPLOY_SHA.yml"
printf 'services:\n' > "$rollback"
for app in api web admin; do
  old_image="$(docker inspect --format '{{.Image}}' "oci-$app-1")"
  docker image tag "$old_image" "kotobawork-oci-$app:rollback-$DEPLOY_SHA"
  printf '  %s:\n    image: kotobawork-oci-%s:rollback-%s\n' "$app" "$app" "$DEPLOY_SHA" >> "$rollback"
done
old_caddy="$base/runtime/Caddyfile.before-$DEPLOY_SHA"
docker exec oci-caddy-1 cat /etc/caddy/Caddyfile > "$old_caddy"
switched=0
rollback_apps() {
  status="$1"
  trap - ERR INT TERM
  set +e
  if [ "$switched" -eq 1 ]; then
    cp "$old_caddy" "$base/deploy/oci/Caddyfile"
    docker compose --project-name oci --env-file "$OCI_ENV_FILE" \
      -f "$OCI_SOURCE_DIR/deploy/oci/docker-compose.oci.yml" -f "$rollback" \
      up -d --no-deps --no-build api web admin caddy
    docker exec oci-caddy-1 caddy validate --config /etc/caddy/Caddyfile
    docker exec oci-caddy-1 caddy reload --config /etc/caddy/Caddyfile
    printf 'Release interrupted or readiness failed; restored previous app images. Database backup retained.\n' >&2
  fi
  exit "$status"
}
trap 'rollback_apps $?' ERR
trap 'rollback_apps 130' INT
trap 'rollback_apps 143' TERM
# Keep the current application serving while images build. Never seed production.
"${compose[@]}" build migrations api web admin
backup="$base/data/backups/releases/nihongo_bjt-$DEPLOY_SHA.dump"
if [ ! -s "$backup" ]; then
  umask 077
  docker exec -u postgres oci-postgres-1 pg_dump -U postgres -d nihongo_bjt -Fc > "$backup.partial"
  docker exec -i oci-postgres-1 pg_restore --list < "$backup.partial" > /dev/null
  mv "$backup.partial" "$backup"
fi
latest_sha="$(gh api "repos/$GITHUB_REPOSITORY/git/ref/heads/main" --jq .object.sha)"
if [ "$latest_sha" != "$DEPLOY_SHA" ]; then
  printf 'Release superseded during build; no production mutation.\n'
  exit 0
fi
"${compose[@]}" --profile tools run --rm --no-deps migrations
switched=1
cp "$OCI_SOURCE_DIR/deploy/oci/Caddyfile" "$base/deploy/oci/Caddyfile"
"${compose[@]}" up -d --no-deps --no-build api web admin caddy
docker exec oci-caddy-1 caddy validate --config /etc/caddy/Caddyfile
docker exec oci-caddy-1 caddy reload --config /etc/caddy/Caddyfile
curl --connect-timeout 5 --max-time 15 --fail --silent --show-error --retry 20 --retry-all-errors --retry-delay 3 \
  http://127.0.0.1:14001/health/ready
curl --connect-timeout 5 --max-time 15 --fail --silent --show-error --retry 20 --retry-all-errors --retry-delay 3 \
  http://127.0.0.1:13000/vi > /dev/null
curl --connect-timeout 5 --max-time 15 --fail --silent --show-error --retry 20 --retry-all-errors --retry-delay 3 \
  http://127.0.0.1:13001/admin/vi/login > /dev/null
curl --connect-timeout 5 --max-time 15 --fail --silent --show-error --retry 24 --retry-all-errors --retry-delay 5 \
  "https://$OCI_PUBLIC_HOST/health/ready"
printf '%s\n' "$DEPLOY_SHA" > "$base/runtime/release-sha.tmp"
mv "$base/runtime/release-sha.tmp" "$base/runtime/release-sha"
printf '\nOracle release ready: %s at https://%s/vi\n' "$DEPLOY_SHA" "$OCI_PUBLIC_HOST"
