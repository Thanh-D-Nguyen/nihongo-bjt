# Database reporting layer (views & materialized views)

SQL artifacts in this folder mirror the **current** Prisma/PostgreSQL model names and schemas (`content`, `learning`, `analytics`, etc.). The **`reporting`** schema (views, MVs, MV indexes) is applied by Prisma migration `20260426190000_reporting_views_materialized_views`. Re-run `scripts/apply_reporting_layer.sh` only for dev/hotfix drift; runtime SQL files live under `scripts/read`, `scripts/write`, `scripts/batch` (see `scripts/README.md`).

## Layout

| Path | Purpose |
|------|---------|
| `views/` | Regular views (`CREATE OR REPLACE VIEW`). Cheap reads; always fresh. |
| `materialized_views/` | Pre-aggregated snapshots; **must be refreshed** (see below). |
| `indexes/` | Supporting indexes for materialized views (required for `REFRESH MATERIALIZED VIEW CONCURRENTLY`). |
| `functions/` | Optional SQL helpers (empty unless added). |
| `scripts/` | Shell helpers + `read/` / `write/` / `batch/` SQL (see `scripts/README.md`). |

## Schema

All objects are created in schema **`reporting`** to avoid collisions with application tables.

```sql
CREATE SCHEMA IF NOT EXISTS reporting;
```

Grant read access for your app/reporting role:

```sql
GRANT USAGE ON SCHEMA reporting TO your_role;
GRANT SELECT ON ALL TABLES IN SCHEMA reporting TO your_role;
-- After new objects:
ALTER DEFAULT PRIVILEGES IN SCHEMA reporting GRANT SELECT ON TABLES TO your_role;
```

## Apply order

1. `views/*.sql` — any order (no cross-dependencies).
2. `materialized_views/*.sql` — base MV definitions.
3. `indexes/*.sql` — unique indexes for concurrent refresh.
4. Re-run `indexes` if you `DROP`/`CREATE` an MV.

Suggested one-shot (psql):

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/scripts/batch/create_reporting_schema.sql
# Then run each file in views/, materialized_views/, indexes/ — or use scripts/apply_all.sql when added.
```

## Refresh strategy (materialized views)

| Materialized view | Suggested frequency | Mechanism |
|-------------------|--------------------|-----------|
| `mv_admin_daily_kpi_summary` | Every 15–60 min / after rollup job | Cron, systemd timer, or **BullMQ** recurring job calling `scripts/batch/refresh_reporting_materialized_views_concurrent.sql` |
| `mv_content_quality_analytics` | Daily | Same |
| `mv_search_quality_daily` | Hourly or daily | Same |
| `mv_learning_engagement_daily_summary` | Hourly | Same |

**BullMQ** (when implemented): enqueue a low-priority job `analytics.refresh_reporting_mvs` that executes `REFRESH MATERIALIZED VIEW CONCURRENTLY` for each MV in dependency-safe order.

**Concurrent refresh** requires a **unique index** on at least one column set per MV (see `indexes/`).

## Idempotency

- Views: `CREATE OR REPLACE VIEW reporting.<name> AS ...`
- Materialized views: files use `DROP MATERIALIZED VIEW IF EXISTS ... CASCADE` then `CREATE` so definitions can evolve during development. In production, prefer a migration that alters carefully.

## Payload contracts

- Search analytics MV assumes learner `content_search_submitted` events include `payload.resultCount` (integer), as emitted by `apps/web/.../search-client.tsx`. Zero-result rate = `resultCount = 0`.
- **Search click-through rate** is not in this MV: there is no `content_search_result_click` (or similar) event in the current API/web codebase. Extend `mv_search_quality_daily` when that event exists.

## Apply helper

```bash
chmod +x database/scripts/apply_reporting_layer.sh
DATABASE_URL="postgres://..." ./database/scripts/apply_reporting_layer.sh
```

This runs `scripts/batch/create_reporting_schema.sql`, all `views/*.sql`, all `materialized_views/*.sql`, `indexes/mv_reporting_unique_indexes.sql`, then `scripts/batch/refresh_reporting_materialized_views_non_concurrent.sql`.

## Quality

- No invented table or column names: all names match `packages/database/prisma/schema.prisma` `@@map` and `@map` as of the commit that added this folder.
