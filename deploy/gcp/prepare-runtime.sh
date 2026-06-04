#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

base_domain="${BASE_DOMAIN:?BASE_DOMAIN is required}"
runtime_dir="deploy/gcp/runtime"
mkdir -p "$runtime_dir"
chmod 700 "$runtime_dir"

secret() {
  openssl rand -hex 24
}

postgres_password="$(secret)"
redis_password="$(secret)"
meili_master_key="$(secret)"
minio_access_key="nihongo$(openssl rand -hex 8)"
minio_secret_key="$(secret)"
keycloak_db_password="$(secret)"
keycloak_admin_password="$(secret)"
oauth_state_secret="$(secret)"
web_client_secret="$(secret)"
admin_client_secret="$(secret)"
user_admin_client_secret="$(secret)"

cat > "$runtime_dir/infrastructure.env" <<EOF
POSTGRES_PASSWORD=$postgres_password
REDIS_PASSWORD=$redis_password
MEILI_MASTER_KEY=$meili_master_key
MINIO_ACCESS_KEY=$minio_access_key
MINIO_SECRET_KEY=$minio_secret_key
KEYCLOAK_DB_PASSWORD=$keycloak_db_password
KEYCLOAK_ADMIN_USERNAME=admin
KEYCLOAK_ADMIN_PASSWORD=$keycloak_admin_password
KEYCLOAK_PUBLIC_URL=https://auth.$base_domain
KEYCLOAK_USER_ADMIN_CLIENT_SECRET=$user_admin_client_secret
EOF

jq \
  --arg web_url "https://app.$base_domain" \
  --arg admin_url "https://admin.$base_domain" \
  --arg web_secret "$web_client_secret" \
  --arg admin_secret "$admin_client_secret" \
  '
    (.clients[] | select(.clientId == "nihongo-web")) |=
      (.secret = $web_secret |
       .redirectUris = [$web_url + "/*"] |
       .webOrigins = [$web_url]) |
    (.clients[] | select(.clientId == "nihongo-admin")) |=
      (.secret = $admin_secret |
       .redirectUris = [$admin_url + "/*"] |
       .webOrigins = [$admin_url])
  ' docker/keycloak/realm-export.json > "$runtime_dir/nihongo-bjt-realm.json"

cat > .env <<EOF
NODE_ENV="production"
DATABASE_URL="postgresql://postgres:$postgres_password@127.0.0.1:15432/nihongo_bjt?schema=content"
API_PORT="4000"
API_PUBLIC_URL="https://api.$base_domain"
WEB_PUBLIC_URL="https://app.$base_domain"
ADMIN_PUBLIC_URL="https://admin.$base_domain"
CORS_ORIGINS="https://app.$base_domain,https://admin.$base_domain"
NEXT_PUBLIC_API_URL="https://api.$base_domain"
API_URL="http://127.0.0.1:4000"
REDIS_URL="redis://:$redis_password@127.0.0.1:6379"
MEILI_HOST="http://127.0.0.1:7700"
MEILI_MASTER_KEY="$meili_master_key"
MINIO_ENDPOINT="127.0.0.1"
MINIO_PORT="9000"
MINIO_ACCESS_KEY="$minio_access_key"
MINIO_SECRET_KEY="$minio_secret_key"
MINIO_BUCKET="nihongo-bjt-media"
MINIO_USE_SSL="false"
MINIO_PUBLIC_ENDPOINT="media.$base_domain"
MINIO_PUBLIC_PORT="443"
MINIO_PUBLIC_USE_SSL="true"
OAUTH_STATE_SECRET="$oauth_state_secret"
GOOGLE_OAUTH_CLIENT_ID=""
GOOGLE_OAUTH_CLIENT_SECRET=""
GOOGLE_OAUTH_REDIRECT_URI="https://api.$base_domain/api/auth/google/callback"
KEYCLOAK_GOOGLE_CLIENT_ID=""
KEYCLOAK_GOOGLE_CLIENT_SECRET=""
KEYCLOAK_ISSUER_URL="https://auth.$base_domain/realms/nihongo-bjt"
KEYCLOAK_CLIENT_ID="nihongo-web"
KEYCLOAK_CLIENT_SECRET="$web_client_secret"
WEB_KEYCLOAK_ISSUER_URL="https://auth.$base_domain/realms/nihongo-bjt"
WEB_KEYCLOAK_CLIENT_ID="nihongo-web"
WEB_KEYCLOAK_CLIENT_SECRET="$web_client_secret"
ADMIN_KEYCLOAK_ISSUER_URL="https://auth.$base_domain/realms/nihongo-bjt"
ADMIN_KEYCLOAK_CLIENT_ID="nihongo-admin"
ADMIN_KEYCLOAK_CLIENT_SECRET="$admin_client_secret"
KEYCLOAK_EXPECTED_AUDIENCE="nihongo-web,nihongo-admin,nihongo-mobile"
KEYCLOAK_PUBLIC_URL="https://auth.$base_domain"
NEXT_PUBLIC_WEB_KEYCLOAK_ISSUER_URL="https://auth.$base_domain/realms/nihongo-bjt"
NEXT_PUBLIC_WEB_KEYCLOAK_URL="https://auth.$base_domain"
NEXT_PUBLIC_WEB_KEYCLOAK_REALM="nihongo-bjt"
NEXT_PUBLIC_WEB_KEYCLOAK_CLIENT_ID="nihongo-web"
NEXT_PUBLIC_ADMIN_KEYCLOAK_ISSUER_URL="https://auth.$base_domain/realms/nihongo-bjt"
NEXT_PUBLIC_ADMIN_KEYCLOAK_URL="https://auth.$base_domain"
NEXT_PUBLIC_ADMIN_KEYCLOAK_REALM="nihongo-bjt"
NEXT_PUBLIC_ADMIN_KEYCLOAK_CLIENT_ID="nihongo-admin"
NEXT_PUBLIC_AUTH_GOOGLE_IDP_HINT=""
NEXT_PUBLIC_AUTH_FACEBOOK_IDP_HINT=""
NEXT_PUBLIC_AUTH_APPLE_IDP_HINT=""
NEXT_PUBLIC_AUTH_LINE_IDP_HINT=""
NEXT_PUBLIC_AUTH_REGISTRATION_ENABLED="true"
KEYCLOAK_ADMIN_REALM_ROLES="admin,superadmin"
KEYCLOAK_ADMIN_INTERNAL_ROLE_ALIASES="admin:admin.super,superadmin:admin.super"
KEYCLOAK_USER_ADMIN_CLIENT_ID="nihongo-user-admin"
KEYCLOAK_USER_ADMIN_CLIENT_SECRET="$user_admin_client_secret"
EOF

chmod 600 .env "$runtime_dir/infrastructure.env"
# Keycloak runs as a non-root UID and must read the bind-mounted realm import.
chmod 644 "$runtime_dir/nihongo-bjt-realm.json"
sed "s/__BASE_DOMAIN__/$base_domain/g" deploy/gcp/Caddyfile.template > "$runtime_dir/Caddyfile"
