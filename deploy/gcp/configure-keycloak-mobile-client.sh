#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."
set -a
. deploy/gcp/runtime/infrastructure.env
set +a

container="gcp-keycloak-1"
kcadm="/opt/keycloak/bin/kcadm.sh"
realm="nihongo-bjt"
client_id="nihongo-mobile"
container_client_file="/opt/keycloak/data/nihongo-mobile-client.json"
container_mapper_file="/opt/keycloak/data/nihongo-mobile-audience-mapper.json"

cleanup() {
  sudo docker exec -u 0 "$container" rm -f "$container_client_file" "$container_mapper_file" >/dev/null 2>&1 || true
}
trap cleanup EXIT

kc() {
  sudo docker exec "$container" "$kcadm" "$@"
}

kc config credentials \
  --server http://127.0.0.1:8080 \
  --realm master \
  --user "$KEYCLOAK_ADMIN_USERNAME" \
  --password "$KEYCLOAK_ADMIN_PASSWORD" >/dev/null

sudo docker exec -u 0 -i "$container" sh -c "cat > '$container_client_file' && chmod 644 '$container_client_file'" <<'JSON'
{
  "clientId": "nihongo-mobile",
  "name": "NihonGo Mobile",
  "description": "Flutter mobile app (public client, PKCE)",
  "enabled": true,
  "publicClient": true,
  "bearerOnly": false,
  "standardFlowEnabled": true,
  "implicitFlowEnabled": false,
  "directAccessGrantsEnabled": true,
  "serviceAccountsEnabled": false,
  "frontchannelLogout": true,
  "protocol": "openid-connect",
  "redirectUris": [
    "com.nihongobjt.app://oauth2redirect"
  ],
  "webOrigins": [],
  "attributes": {
    "post.logout.redirect.uris": "com.nihongobjt.app://oauth2redirect",
    "pkce.code.challenge.method": "S256"
  },
  "fullScopeAllowed": true
}
JSON

client_uuid="$(
  kc get clients \
    -r "$realm" \
    -q "clientId=$client_id" \
    --fields id \
    --format csv \
    --noquotes |
    head -n 1
)"

if [[ -n "$client_uuid" ]]; then
  kc update "clients/$client_uuid" -r "$realm" -f "$container_client_file" >/dev/null
else
  client_uuid="$(kc create clients -r "$realm" -f "$container_client_file" -i)"
fi

sudo docker exec -u 0 -i "$container" sh -c "cat > '$container_mapper_file' && chmod 644 '$container_mapper_file'" <<'JSON'
{
  "name": "nihongo-mobile audience",
  "protocol": "openid-connect",
  "protocolMapper": "oidc-audience-mapper",
  "consentRequired": false,
  "config": {
    "included.client.audience": "nihongo-mobile",
    "id.token.claim": "false",
    "access.token.claim": "true"
  }
}
JSON

mapper_ids="$(
  kc get "clients/$client_uuid/protocol-mappers/models" \
    -r "$realm" \
    --fields id,name \
    --format csv \
    --noquotes |
    awk -F, '$2 == "nihongo-mobile audience" { print $1 }'
)"

while IFS= read -r mapper_id; do
  [[ -n "$mapper_id" ]] || continue
  kc delete "clients/$client_uuid/protocol-mappers/models/$mapper_id" -r "$realm" >/dev/null || true
done <<<"$mapper_ids"

kc create "clients/$client_uuid/protocol-mappers/models" \
  -r "$realm" \
  -f "$container_mapper_file" >/dev/null

printf 'Configured Keycloak client: %s\n' "$client_id"
