#!/usr/bin/env bash
set -euo pipefail

cd /home/deploy/nihongo-bjt
EXPECTED_NODE_VERSION="$(tr -d '[:space:]' < .node-version)"
ACTUAL_NODE_VERSION="$(node --version | sed 's/^v//')"
if [ "$ACTUAL_NODE_VERSION" != "$EXPECTED_NODE_VERSION" ]; then
  printf 'Node.js %s is required, but the VM is running %s.\n' "$EXPECTED_NODE_VERSION" "$ACTUAL_NODE_VERSION" >&2
  exit 1
fi

set -a
. ./.env
set +a

chmod +x deploy/gcp/*.sh
./deploy/gcp/backup-postgres.sh

# Local developer overrides must never participate in a production Next.js build.
rm -f apps/web/.env.local apps/admin/.env.local apps/api/.env.local
rm -rf apps/web/.next apps/admin/.next

pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm exec prisma migrate deploy --schema packages/database/prisma/schema.prisma
pnpm seed:bjt:official-mocks
pnpm seed:bjt-lessons
./deploy/gcp/apply-recommendation-schema.sh
./deploy/gcp/configure-keycloak-mobile-client.sh
./deploy/gcp/link-keycloak-admin.sh
pnpm build
pnpm search:index

pm2 startOrReload deploy/gcp/ecosystem.config.cjs --update-env
pm2 save

curl --fail --silent --show-error \
  --retry 12 \
  --retry-delay 5 \
  https://api.34-87-55-1.sslip.io/api/health/ready
printf '\nDeployment complete.\n'
