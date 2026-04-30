# Backup and restore (PostgreSQL, object storage, Meilisearch)

## PostgreSQL (source of truth)

- **Health**: `GET http://localhost:4000/api/health/live` (process up), `GET .../api/health/ready` (DB `SELECT 1` + checks), `GET .../api/health/version` (build metadata).
- **Logical backup** (one database):

```bash
# Replace connection params for your environment
pg_dump "postgresql://USER:PASS@127.0.0.1:15432/nihongo_bjt" \
  -Fc -f nihongo_bjt_$(date +%Y%m%d).dump
```

- **Restore** (to an empty or prepared database; test on a copy first):

```bash
pg_restore -d "postgresql://USER:PASS@127.0.0.1:15432/nihongo_bjt_restore" \
  --no-owner --verbose nihongo_bjt_YYYYMMDD.dump
```

- Keep at least one off-host copy of Prisma **migrations** (`packages/database/prisma/migrations/`) in version control; restore order is **schema from migrations** then **data from dump**, or a single `pg_restore` of a custom-format dump that matches your policy.

## MinIO / S3-compatible (media, presigned objects)

- Mirror buckets with the provider CLI (e.g. `mc mirror` for MinIO) to another bucket or path on a schedule.
- Document the **object key** layout your app uses (e.g. per-tenant prefixes) and ensure backup runs **after** any admin bulk import.

## Meilisearch (search projection; rebuildable)

- Treat the index as **rebuildable** from PostgreSQL: keep PostgreSQL + migration history as the restore baseline, then re-run your `search:index` (or equivalent) job after a disaster.
- Optional: export index snapshots if your ops policy requires a warm standby index.

## Redis / BullMQ

- Queue state is usually **ephemeral**; for DR, restore PostgreSQL, redeploy workers, and re-drive failed or idempotent jobs from your dead-letter or retry policy as needed.

## Verification after restore

- Run `pnpm prisma:validate` and `pnpm prisma:generate` against the restored database URL.
- Hit `/api/health/ready` and spot-check a learner read path (e.g. daily hub, flashcard due) before switching traffic.
