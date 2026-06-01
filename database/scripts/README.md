# SQL scripts layout

Operational and **runtime-invoked** SQL lives under `migrations/`. Prisma remains the default for simple CRUD; use files under `migrations/read/` / `migrations/write/` when a query is join-heavy, aggregation-heavy, or must match a reviewed execution plan.

| Folder   | Purpose |
|----------|---------|
| `migrations/read/`  | `SELECT` scripts for the API (parameterized with `$1`, `$2`, …). Prefer `reporting.*` views for dashboards instead of duplicating view SQL in TypeScript. |
| `migrations/write/` | `INSERT` / `UPDATE` / `DELETE` (or `COPY`) too awkward or slow via Prisma; keep **data access only**—no business rules beyond constraints. |
| `migrations/batch/` | Maintenance: schema stubs, MV refresh, one-off ops. Invoked by `psql`, CI, or schedulers—not per HTTP request. |

## Loader (TypeScript)

From `@nihongo-bjt/database`:

- `loadSqlFileSync("read", "reporting_user_learning_dashboard_by_user.sql")`
- `loadSqlFile("write", "…")` (async)

Resolution: walk up from the package source tree until `database/scripts/migrations/<category>` exists, or set `NIHONGO_BJT_REPO_ROOT`.

## Root-level shell

- `migrations/apply_reporting_layer.sh` — reapplies `database/views`, MVs, and indexes (dev/hotfix). Production definitions are applied by `prisma migrate deploy`.

## Rules

- **No duplicate shapes**: if a `reporting` view already exposes the rowset, query the view from `read/` instead of re-encoding the same joins in Prisma.
- **No business logic in SQL**: filters/defaults that encode product rules belong in services; SQL holds predicates parameters and schema-aligned projections.
