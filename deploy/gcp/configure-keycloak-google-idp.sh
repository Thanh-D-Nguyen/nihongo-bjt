#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."
set -a
. ./.env
. deploy/gcp/runtime/infrastructure.env
set +a

container="gcp-keycloak-1"
kcadm="/opt/keycloak/bin/kcadm.sh"
realm="nihongo-bjt"
alias="google"

: "${KEYCLOAK_GOOGLE_CLIENT_ID:?KEYCLOAK_GOOGLE_CLIENT_ID is required in .env}"
: "${KEYCLOAK_GOOGLE_CLIENT_SECRET:?KEYCLOAK_GOOGLE_CLIENT_SECRET is required in .env}"

sudo docker exec "$container" "$kcadm" config credentials \
  --server http://127.0.0.1:8080 \
  --realm master \
  --user "$KEYCLOAK_ADMIN_USERNAME" \
  --password "$KEYCLOAK_ADMIN_PASSWORD" >/dev/null

provider_id="$(
  sudo docker exec "$container" "$kcadm" get identity-provider/instances \
    -r "$realm" \
    --fields alias \
    --format csv \
    --noquotes |
    awk -v alias="$alias" '$0 == alias { print alias }'
)"

settings=(
  -s "alias=$alias"
  -s "providerId=$alias"
  -s enabled=true
  -s trustEmail=true
  -s storeToken=false
  -s addReadTokenRoleOnCreate=false
  -s "config.clientId=$KEYCLOAK_GOOGLE_CLIENT_ID"
  -s "config.clientSecret=$KEYCLOAK_GOOGLE_CLIENT_SECRET"
  -s 'config.defaultScope=openid profile email'
)

if [[ -n "$provider_id" ]]; then
  sudo docker exec "$container" "$kcadm" update "identity-provider/instances/$alias" \
    -r "$realm" \
    "${settings[@]}" >/dev/null
else
  sudo docker exec "$container" "$kcadm" create identity-provider/instances \
    -r "$realm" \
    "${settings[@]}" >/dev/null
fi

printf 'Configured Keycloak identity provider: %s\n' "$alias"
