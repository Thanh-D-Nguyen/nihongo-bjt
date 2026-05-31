#!/usr/bin/env bash
set -euo pipefail

cd /home/deploy/nihongo-bjt
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
./deploy/gcp/apply-recommendation-schema.sh
./deploy/gcp/link-keycloak-admin.sh
pnpm build

pm2 startOrReload deploy/gcp/ecosystem.config.cjs --update-env
pm2 save

curl --fail --silent --show-error \
  --retry 12 \
  --retry-delay 5 \
  https://api.34-87-55-1.sslip.io/api/health/ready
printf '\nDeployment complete.\n'
