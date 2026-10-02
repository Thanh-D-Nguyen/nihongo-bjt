#!/usr/bin/env bash
# Apply the canonical schema to an EMPTY disposable PostgreSQL database:
# Prisma migrations (packages/database) + Go-side SQL (apps/api-go/internal/postgres/migrations).
# Used by CI and scripts/quality/with-test-db.sh. Never point this at a shared database.
# Usage: scripts/quality/provision-test-schema.sh <postgres-url>
set -euo pipefail

url="${1:?usage: provision-test-schema.sh <postgres-url>}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

# Same Prisma URL shape as the CI frontend job.
case "$url" in
  *\?*) prisma_url="$url" ;;
  *) prisma_url="$url?schema=content" ;;
esac

echo "=== prisma migrate deploy"
DATABASE_URL="$prisma_url" pnpm exec prisma migrate deploy --schema packages/database/prisma/schema.prisma

for f in apps/api-go/internal/postgres/migrations/*.sql; do
  echo "=== apply $f"
  # Prisma 7 reads the datasource for `db execute` from prisma.config.ts (DATABASE_URL).
  DATABASE_URL="$prisma_url" pnpm exec prisma db execute --file "$f"
done
echo "Canonical test schema provisioned."
