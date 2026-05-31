#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."
set -a
. deploy/gcp/runtime/infrastructure.env
set +a

container="gcp-keycloak-1"
kcadm="/opt/keycloak/bin/kcadm.sh"
client_id="nihongo-user-admin"

sudo docker exec "$container" "$kcadm" config credentials \
  --server http://127.0.0.1:8080 \
  --realm master \
  --user "$KEYCLOAK_ADMIN_USERNAME" \
  --password "$KEYCLOAK_ADMIN_PASSWORD"

client_uuid="$(
  sudo docker exec "$container" "$kcadm" get clients \
    -r nihongo-bjt \
    -q "clientId=$client_id" \
    --fields id \
    --format csv \
    --noquotes
)"

if [[ -z "$client_uuid" ]]; then
  client_uuid="$(
    sudo docker exec "$container" "$kcadm" create clients \
      -r nihongo-bjt \
      -s "clientId=$client_id" \
      -s enabled=true \
      -s publicClient=false \
      -s standardFlowEnabled=false \
      -s directAccessGrantsEnabled=false \
      -s serviceAccountsEnabled=true \
      -s "secret=$KEYCLOAK_USER_ADMIN_CLIENT_SECRET" \
      -i
  )"
else
  sudo docker exec "$container" "$kcadm" update "clients/$client_uuid" \
    -r nihongo-bjt \
    -s enabled=true \
    -s publicClient=false \
    -s standardFlowEnabled=false \
    -s directAccessGrantsEnabled=false \
    -s serviceAccountsEnabled=true \
    -s "secret=$KEYCLOAK_USER_ADMIN_CLIENT_SECRET"
fi

sudo docker exec "$container" "$kcadm" add-roles \
  -r nihongo-bjt \
  --uusername "service-account-$client_id" \
  --cclientid realm-management \
  --rolename manage-users \
  --rolename view-users \
  --rolename query-users
