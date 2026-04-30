-- reporting schema for views/MVs (idempotent; also created in Prisma migration 20260426190000_reporting_views_materialized_views)
CREATE SCHEMA IF NOT EXISTS reporting;

COMMENT ON SCHEMA reporting IS
  'Read-optimized views and materialized views; definitions applied via Prisma Migrate (see packages/database/prisma/migrations).';
