# Pre-launch checklist (NihonGo BJT)

Use this as a release gate; adapt env names and URLs to staging/production.

## Build and quality

- [ ] `pnpm install` (lockfile committed and reproducible)
- [ ] `pnpm format`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm prisma:validate` and `pnpm prisma:generate` against the target database URL
- [ ] `pnpm test:e2e` in CI, or with learner web already on port 3000: `pnpm test:e2e:local` (install browsers first: `pnpm test:e2e:install`)
- [ ] `pnpm --filter @nihongo-bjt/web run build` and `pnpm --filter @nihongo-bjt/admin run build` (if shipping admin)
- [ ] `pnpm --filter @nihongo-bjt/api` — API build or `tsc` as per package scripts

## Configuration and secrets

- [ ] `.env` / platform secrets: `DATABASE_URL`, `API_PORT`, `CORS_ORIGINS`, object storage, Redis, Meilisearch, etc.
- [ ] No development-only defaults in production (cookie flags, CORS `*`, stack traces in responses)
- [ ] `NEXT_PUBLIC_API_URL` (learner web) points to the public API base the browser can reach

## Data and services

- [ ] PostgreSQL migrated (`prisma migrate deploy` or your pipeline)
- [ ] Health endpoints respond: `GET /api/health/live`, `GET /api/health/ready`, `GET /api/health/version`
- [ ] Object storage (MinIO/S3) CORS and bucket policy allow learner `PUT`/`GET` as designed
- [ ] Meilisearch index job (`search:index`) if search is in scope for this release
- [ ] Backups: see `docs/ops/backup-restore.md` and confirm schedule ownership

## Product and safety

- [ ] User-facing copy only from i18n resources (vi/ja minimum)
- [ ] Admin or sensitive actions audited and permission-checked on the server
- [ ] Privacy: export/deletion requests handled per policy (see known limitations if still skeleton)

## Rollout

- [ ] Staging smoke: learner home, one learning flow, health
- [ ] Rollback plan: previous image + DB restore window
- [ ] On-call and incident channel agreed

After launch, file issues for anything deferred; keep `docs/product/known-limitations-and-backlog.md` updated.
