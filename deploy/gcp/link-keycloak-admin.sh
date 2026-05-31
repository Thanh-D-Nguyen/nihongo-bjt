#!/usr/bin/env bash
set -euo pipefail

cd /home/deploy/nihongo-bjt
set -a
. deploy/gcp/runtime/infrastructure.env
set +a

container="gcp-keycloak-1"
kcadm="/opt/keycloak/bin/kcadm.sh"
realm="nihongo-bjt"
username="${KEYCLOAK_LINK_ADMIN_USERNAME:-localadmin}"
actor_id="${KEYCLOAK_LINK_ADMIN_ACTOR_ID:-00000000-0000-4000-8000-000000000001}"

uuid_pattern='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
if [[ ! "$actor_id" =~ $uuid_pattern ]]; then
  printf 'Invalid internal admin actor UUID: %s\n' "$actor_id" >&2
  exit 1
fi

sudo docker exec "$container" "$kcadm" config credentials \
  --server http://127.0.0.1:8080 \
  --realm master \
  --user "$KEYCLOAK_ADMIN_USERNAME" \
  --password "$KEYCLOAK_ADMIN_PASSWORD" >/dev/null

keycloak_subject="$(
  sudo docker exec "$container" "$kcadm" get users \
    -r "$realm" \
    -q "username=$username" \
    --fields id \
    --format csv \
    --noquotes
)"

if [[ ! "$keycloak_subject" =~ $uuid_pattern ]]; then
  printf 'Expected one Keycloak UUID for admin user %s\n' "$username" >&2
  exit 1
fi

updated_actor="$(
  sudo docker exec -i gcp-postgres-1 \
    psql \
    --username postgres \
    --dbname nihongo_bjt \
    --tuples-only \
    --no-align \
    --set ON_ERROR_STOP=1 <<SQL | sed -n '1p'
UPDATE authz.admin_actor
SET keycloak_subject = '$keycloak_subject',
    updated_at = NOW()
WHERE id = '$actor_id'::uuid
RETURNING id;
SQL
)"

if [[ "$updated_actor" != "$actor_id" ]]; then
  printf 'Admin actor does not exist. Run the foundation seed first.\n' >&2
  exit 1
fi

printf 'Linked Keycloak admin %s to internal actor %s\n' "$username" "$actor_id"
