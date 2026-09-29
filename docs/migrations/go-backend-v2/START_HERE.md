# KotobaWork — Go Backend Migration Kit v2 (Rebaselined)

This package is the canonical migration plan for migrating KotobaWork / BJT from:

- NestJS API
- Keycloak authentication
- MinIO object storage
- two Next.js runtimes

to a lean Oracle-friendly target:

- Go API (net/http + chi, pgx, sqlc, slog, go-redis)
- first-party application authentication (opaque sessions, Argon2id)
- PostgreSQL-backed identity/session state
- Redis for ephemeral/cache/rate-limit/realtime use
- Meilisearch retained for Japanese/typo-tolerant search
- `gocloud.dev/blob` storage abstraction with `fileblob` backend
- local filesystem storage on the Oracle data volume (`/srv/kotobawork/data/media`)
- Caddy serving public static media directly; Go streaming private media
- Learner Web keeps Next.js runtime (KEEP_NEXT_RUNTIME)
- Admin evaluated for static export only after M6 auth cutover

## Primary objective

Reduce runtime complexity, RAM use, upgrade surface, and operational failure points on a single Oracle Ampere A1 free server while preserving:

- correctness;
- security;
- production behavior;
- rollback;
- API compatibility;
- future portability to S3-compatible storage.

## Target server

Expected Oracle target:

- `VM.Standard.A1.Flex`
- ARM64 / aarch64
- 4 OCPU
- ~23–24 GB usable RAM
- 50 GB boot volume
- 150 GB data volume
- single-host Docker Compose deployment
- no normal-operation dependence on swap

## Target lean architecture

```text
                         Internet
                            │
                          Caddy
                            │
          ┌─────────────────┼───────────────────┐
          │                 │                   │
          ▼                 ▼                   ▼
     Next Web          Admin Static          /media/public/*
   (KEEP_NEXT_         (eval post-M6)           │
    RUNTIME)                                  Caddy file_server
          │                                     │
          └───────────────┐                     ▼
                          ▼             /srv/kotobawork/data/media
                        Go API
                          │
            ┌─────────────┼──────────────┐
            │             │              │
            ▼             ▼              ▼
       PostgreSQL       Redis       Meilisearch
            │
      Auth / Sessions
```

## Removed in final target

- NestJS runtime
- Keycloak runtime
- MinIO runtime
- unnecessary Node runtime for Admin (if static export passes post-M6)

Learner Web Node runtime is **retained** (KEEP_NEXT_RUNTIME).

## Storage principle

Do **not** replace MinIO with another object-storage server.

Application code uses a small internal interface:

```text
MediaService
   ↓
BlobStore
   ↓
gocloud.dev/blob
   ↓
fileblob
   ↓
/srv/kotobawork/data/media
```

Future storage can switch to:

```text
gocloud.dev/blob/s3blob
   ↓
RustFS / AWS S3 / Cloudflare R2 / another S3-compatible backend
```

without changing business-domain code.

### Upload architecture decision

`fileblob` does not support presigned URLs. The current browser-direct presigned PUT upload flow is replaced with:

```text
Browser → Go API → streaming upload → temp file → validate → atomic rename → LocalFS
```

Implementation requirements:

- stream, never buffer entire upload in RAM
- enforce size limits (MaxBytesReader or equivalent)
- validate filename/object key; prevent traversal
- validate allowed content type; inspect actual content where appropriate
- compute checksum where useful
- clean partial/temp files after error
- use safe atomic finalization
- support cancellation
- handle duplicate/retry semantics deliberately

Do NOT implement custom signed PUT URLs in Caddy.

### Media read paths

Public/cacheable media:

```text
Browser → Caddy → /srv/kotobawork/data/media/public
```

Private media:

```text
Browser → Go API → auth → authorization → filesystem stream (http.ServeContent)
```

Do NOT expose private media through Caddy file_server. Do NOT introduce custom Caddy auth plugins during this migration.

## Non-negotiable migration principles

1. Inspect repository truth before editing.
2. No big-bang rewrite.
3. Do not remove Keycloak before replacement auth is verified for ALL clients (web, admin, mobile, realtime).
4. Do not remove MinIO before media inventory, checksum validation, and cutover tests.
5. Do not change production DNS or destroy GCP during implementation.
6. Do not invent endpoints, schemas, roles, claims, object keys, or auth behavior.
7. Preserve backward compatibility until callers are migrated.
8. Migrate in independently verifiable checkpoints.
9. Every checkpoint needs tests and rollback.
10. Never commit production secrets.
11. ARM64 compatibility is mandatory.
12. Do not add RustFS or another S3 server unless a real requirement justifies it.
13. Legacy credential migration is NOT_REQUIRED: the user approved an identity/account reset on 2026-09-29. Build fresh Go Argon2id auth; preserve non-user content and media. See `docs/03_auth_replacement_spec.md`.
14. Mobile client (`nihongo-mobile`) is in scope for auth migration.
15. Background jobs and realtime have dedicated migration waves.

## Read order

1. `GHOSTCLI_MASTER_PROMPT.md`
2. `docs/01_repo_audit.md`
3. `docs/02_target_architecture.md`
4. `docs/03_auth_replacement_spec.md`
5. `docs/04_data_migration.md`
6. `docs/05_api_migration.md`
7. `docs/06_execution_waves.md`
8. `docs/07_testing_strategy.md`
9. `docs/08_rollout_and_rollback.md`
10. `docs/09_oracle_resource_budget.md`
11. `docs/10_security_baseline.md`
12. `docs/11_observability.md`
13. `docs/12_definition_of_done.md`
14. `docs/13_storage_architecture.md`
15. `docs/14_static_frontend_audit.md`
16. `docs/15_mobile_auth_migration.md`
17. `docs/16_background_jobs_migration.md`
18. `docs/17_realtime_migration.md`
19. `docs/18_media_delivery_architecture.md`

## Required first action

Execute M0 (Repository Truth / Detailed Inventory) as defined in `docs/06_execution_waves.md`.

Populate:

- `templates/repo-inventory.md`
- `templates/api-compatibility-matrix.csv`
- `templates/auth-behavior-matrix.csv`
- `templates/media-migration-inventory.csv`
- `templates/migration-status.md`

before the first production behavior change.

## Reports

- `reports/P0_PLAN_REVALIDATION_REPORT.md` — initial plan validation against repository truth
- `reports/P0_1_PLAN_REBASE_REPORT.md` — rebaseline applying ChatGPT-approved architectural decisions
