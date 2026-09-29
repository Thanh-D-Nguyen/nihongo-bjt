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
oauth_state_secret="$(secret)"

# M17: Keycloak infrastructure env removed — auth is Go-native sessions (M13).
cat > "$runtime_dir/infrastructure.env" <<EOF
POSTGRES_PASSWORD=$postgres_password
REDIS_PASSWORD=$redis_password
MEILI_MASTER_KEY=$meili_master_key
MINIO_ACCESS_KEY=$minio_access_key
MINIO_SECRET_KEY=$minio_secret_key
EOF

# M17: Keycloak realm generation removed — preserved on disk for rollback only.

cat > .env <<EOF
NODE_ENV="production"
DATABASE_URL="postgresql://postgres:$postgres_password@127.0.0.1:15432/nihongo_bjt?schema=content"
API_PORT="4000"
API_PUBLIC_URL="https://api.$base_domain"
WEB_PUBLIC_URL="https://app.$base_domain"
ADMIN_PUBLIC_URL="https://admin.$base_domain"
CORS_ORIGINS="https://app.$base_domain,https://admin.$base_domain"
NEXT_PUBLIC_API_URL="https://api.$base_domain"
API_URL="http://127.0.0.1:4001"
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
NEXT_PUBLIC_AUTH_GOOGLE_IDP_HINT=""
NEXT_PUBLIC_AUTH_FACEBOOK_IDP_HINT=""
NEXT_PUBLIC_AUTH_APPLE_IDP_HINT=""
NEXT_PUBLIC_AUTH_LINE_IDP_HINT=""
NEXT_PUBLIC_AUTH_REGISTRATION_ENABLED="true"
EOF

chmod 600 .env "$runtime_dir/infrastructure.env"
sed "s/__BASE_DOMAIN__/$base_domain/g" deploy/gcp/Caddyfile.template > "$runtime_dir/Caddyfile"