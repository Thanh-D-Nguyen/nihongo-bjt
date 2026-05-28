#!/usr/bin/env bash
# Re-apply reporting SQL from database/views, materialized_views, indexes (dev / hotfix).
# Normal deploy: run `pnpm exec prisma migrate deploy` in packages/database — migration
# 20260426190000_reporting_views_materialized_views already creates schema, views, MVs, indexes, refresh.
# Usage: DATABASE_URL=postgres://... ./database/scripts/apply_reporting_layer.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PGOPTIONS="${PGOPTIONS:-}"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT/scripts/batch/create_reporting_schema.sql"

shopt -s nullglob
for f in "$ROOT/views"/*.sql; do
  echo "Applying $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done

for f in "$ROOT/materialized_views"/*.sql; do
  echo "Applying $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT/indexes/mv_reporting_unique_indexes.sql"

echo "Done. Initial MV refresh (non-concurrent; safe before first CONCURRENTLY):"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT/scripts/batch/refresh_reporting_materialized_views_non_concurrent.sql"
