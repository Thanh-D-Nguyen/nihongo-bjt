# GhostCLI / Opus 5.5 Master Prompt — KotobaWork Lean Migration v2 (Rebaselined)

You are the principal engineer responsible for migrating the real **KotobaWork / BJT** repository to a lean production architecture optimized for Oracle Ampere A1.

The repository, tests, migrations, runtime manifests, and current production behavior are the source of truth.

Do not assume historical architecture is still exact.

---

# Mission

Migrate away from:

```text
NestJS
Keycloak
MinIO
unnecessary persistent Node runtimes
```

toward:

```text
Caddy
├── learner Web (KEEP_NEXT_RUNTIME — force-dynamic SSR required)
├── Admin static files (evaluate ONLY after M6 auth cutover)
├── /media/public/* static serving (Caddy file_server)
└── reverse proxy to Go API

Go API
├── first-party auth (opaque sessions, Argon2id)
├── sessions/RBAC
├── business APIs
├── streaming upload endpoint (replaces presigned PUT)
├── authorized private media streaming (http.ServeContent)
├── PostgreSQL
├── Redis where justified
├── Meilisearch where justified
├── background jobs / cron workers
├── realtime WebSocket gateway (replaces Socket.IO)
└── BlobStore abstraction

BlobStore
└── gocloud.dev/blob/fileblob
    └── /srv/kotobawork/data/media
```

Future storage portability:

```text
fileblob → s3blob → RustFS / S3 / R2
```

Do not deploy RustFS or another object-storage server unless repository requirements prove that local object storage semantics are insufficient.

Target infrastructure:

```text
Oracle VM.Standard.A1.Flex
4 OCPU
~23–24 GB usable RAM
ARM64
single host
```

Priorities:

1. correctness;
2. security;
3. rollback;
4. backward compatibility;
5. low RAM and low service count;
6. maintainability;
7. ARM64 viability.

---

# Hard rules

## Repository truth

Before implementation:

```bash
pwd
git status --short
git branch --show-current
git rev-parse HEAD
git diff --stat
git diff
```

Read:

```text
AGENTS.md
CLAUDE.md
README*
docs/
package.json
pnpm-workspace.yaml
Dockerfile*
docker-compose*
Prisma schema/migrations
CI workflows
deployment manifests
auth configuration
Keycloak realm/client configuration
MinIO/S3/storage configuration
Next.js configs
```

Do not overwrite unrelated dirty work.

## No big-bang rewrite

Use strangler migration.

Never remove NestJS, Keycloak, MinIO, or a Next runtime merely because a replacement compiles.

## Do not invent contracts

Derive behavior from:

- route/controller code;
- DTO/Zod/class-validator schemas;
- OpenAPI if present;
- tests;
- web/admin callers;
- DB schema;
- Keycloak config;
- storage/object-key usage;
- guards/middleware;
- websocket/realtime;
- upload/download behavior.

Populate the provided compatibility and media inventories.

## Production safety

Do not:

- destroy current production;
- cut DNS early;
- delete Keycloak early;
- delete MinIO data early;
- reset legacy identity/credentials before fresh Go auth, client cutovers, a tested backup, and an independently reviewed identity-only reset manifest;
- rewrite media keys without migration proof;
- commit secrets;
- perform irreversible schema/data cleanup before rollback window closes.

---

# Preferred Go stack

Default unless repository evidence requires otherwise:

```text
Go stable
net/http
chi
pgx/v5
sqlc where useful
slog
go-redis
gocloud.dev/blob
gocloud.dev/blob/fileblob
golang.org/x/crypto/argon2
crypto/rand
```

Avoid recreating NestJS dependency-injection complexity.

Prefer explicit composition and small interfaces.

---

# Storage target

MinIO is NOT part of the final target architecture.

Implement a narrow application-owned abstraction, for example:

```go
type BlobStore interface {
    Put(ctx context.Context, key string, r io.Reader, meta PutOptions) error
    Open(ctx context.Context, key string) (io.ReadCloser, ObjectInfo, error)
    Stat(ctx context.Context, key string) (ObjectInfo, error)
    Delete(ctx context.Context, key string) error
}
```

Actual shape may differ, but business domains must not depend directly on MinIO SDK or filesystem-specific paths.

Initial implementation:

```text
gocloud.dev/blob
        ↓
fileblob
        ↓
/srv/kotobawork/data/media
```

Database stores stable object keys and metadata, not absolute host paths.

Example key:

```text
bjt/questions/<question-id>/audio.mp3
```

## Upload architecture (FINAL DECISION)

`fileblob` does not support presigned URLs. The current browser-direct presigned PUT upload flow is REPLACED with:

```text
Browser → Go API → streaming upload → temp file → validate → atomic rename → LocalFS
```

Implementation MUST:

- stream, never buffer entire upload in RAM
- enforce MaxBytesReader/equivalent size limits
- validate filename/object key; prevent traversal
- validate allowed content type; inspect actual content where appropriate
- compute checksum where useful
- clean partial/temp files after error
- use safe atomic finalization
- support cancellation
- handle duplicate/retry semantics deliberately

Do NOT implement custom signed PUT URLs in Caddy.

## Media read paths

Public/cacheable media:

```text
Browser → Caddy → /srv/kotobawork/data/media/public
```

Private media:

```text
Browser → Go API → auth → authorization → filesystem stream (http.ServeContent)
```

Do NOT expose private media through Caddy file_server.
Do NOT introduce custom Caddy auth plugins during this migration.

See `docs/13_storage_architecture.md` and `docs/18_media_delivery_architecture.md`.

---

# Frontend runtime optimization

## Learner Web: KEEP_NEXT_RUNTIME

Canonical classification based on repository evidence:

- `force-dynamic` layout
- server-side `cookies()` reads
- server-side auth shell (`KeycloakAuthShell`)
- runtime auth behavior
- server-loaded i18n messages
- Socket.IO client integration (battle, flashcards, quiz, scenarios)

Do NOT attempt static export during this migration.

## Admin: NEEDS_INVESTIGATION_POST_M6

Admin currently uses `force-dynamic` with server-side Keycloak session gating.

Static export evaluation occurs ONLY after M6 (admin auth cutover) proves Go cookie sessions work correctly.

Admin static export is an optimization, not a prerequisite.

See `docs/14_static_frontend_audit.md`.

---

# Auth migration scope

Keycloak removal scope MUST include:

- learner Web
- Admin
- Flutter/mobile `nihongo-mobile` (PKCE public client)
- backend API
- realtime authentication
- Google OAuth (if active)
- role/permission mapping
- existing Keycloak subject mappings

Keycloak cannot be disabled until ALL active clients have migrated.

## Password migration / identity reset decision (2026-09-29)

`LEGACY_CREDENTIAL_MIGRATION = NOT_REQUIRED`; `IDENTITY_RESET_APPROVED = TRUE`. The user approved resetting legacy identity/account data because there is no meaningful production user population. Build fresh Go Argon2id auth with application-owned IDs; do not inspect production Keycloak credential hashes, build a legacy verifier, or implement re-auth/compatibility reset. Preserve authored content, curriculum, media, search source content, product configuration, and non-user reference data. Defer destructive identity cleanup until replacement auth and all affected clients work, then require a foreign-key inventory, row counts, tested backup, and independently reviewed exact reset manifest. Keep GCP rollback through the stability window.

See `docs/03_auth_replacement_spec.md` and `docs/15_mobile_auth_migration.md`.

---

# Background jobs

Dedicated migration wave (M10).

Current known scope:

- ComebackExperienceCron
- MagazineGenerationCron
- LotoAutopilotCron
- PushNotificationCron
- SmartNotificationCron
- BullMQ usage in recommendation, revenge-mode, operations, analytics

M0 must inventory producers, consumers, retries, scheduling, timezones, deduplication, idempotency, persistence, failure semantics.

Do NOT prematurely commit to robfig/cron, Asynq, River, or another queue library in P0.1.

See `docs/16_background_jobs_migration.md`.

---

# Realtime

Dedicated migration wave (M12).

Current scope:

- BattleGateway (12+ Socket.IO events)
- PresenceGateway (heartbeat/query)
- frontend socket.io-client consumers (7+ components)
- connection authentication

Do NOT use SSE for Battle (bidirectional realtime).

M0/M12 must inventory event names, payload contracts, acknowledgement semantics, rooms/lobbies, reconnection, heartbeats, auth, ordering assumptions.

Then choose between native WebSocket protocol migration or another actively maintained compatible solution.

NestJS may temporarily remain as a realtime slice until this wave completes.

See `docs/17_realtime_migration.md`.

---

# Billing webhooks

Stripe/billing webhook migration is explicit scope.

Preserve exact signature verification and idempotency semantics.

Do not generalize or simplify payment security.

---

# Image processing

Sharp is used for image resizing/proxying and share-image rendering.

M0/M11 must inventory actual operations (resize, proxy, share-image rendering, metadata, encoding formats).

Then choose: implement in Go, temporarily retain narrowly scoped worker, or simplify safely.

---

# Application containerization

M1 must:

- establish ARM64 production build/deployment strategy for Go
- inspect how current Next Web/Admin/API are actually deployed
- add only Dockerfiles actually required for transition/Oracle

Do NOT automatically create a NestJS Dockerfile if not required for migration/deployment path.

---

# Caddy security

Current Keycloak admin-IP restriction on `auth.__DOMAIN__/admin*` is evidence of a security control.

After Keycloak removal, document what threat/control it served and whether an equivalent privileged endpoint exists. Preserve or formally retire based on new architecture.

---

# Execution waves (rebaselined)

```text
P0     Plan revalidation                         DONE
P0.1   Plan rebase                               DONE
M0     Repository truth / detailed inventory
H0     Documentation hygiene
M1     Go foundation + deployment foundations
M2     Identity/auth persistence + approved identity-reset decision
M3     Auth core
M4     Account lifecycle + Google OAuth decision/migration
M5     Learner Web auth cutover
M5.5   Mobile auth cutover
M6     Admin auth cutover
M6.5   Admin static-runtime evaluation
M7     BlobStore + media migration (streaming uploads, Caddy public, Go private)
M8     Business read APIs
M9     Business write APIs
M10    Background jobs / queue migration
M11    Remaining integrations (billing webhooks, image processing)
M12    Realtime migration
M13    Keycloak disable
M14    MinIO disable
M15    NestJS disable
M16    Oracle runtime/resource optimization
```

Retirement ordering:

- Keycloak: all Web/Admin/Mobile/realtime auth migrated → disable → stability window → delete later
- MinIO: all media write/read migrated → reconciliation/checksums → disable → stability window → delete later
- NestJS: all HTTP APIs + jobs/workers + webhooks + image processing + realtime migrated → disable → stability window → delete later

---

# Validation

Per wave run relevant:

- Go tests;
- race tests where practical;
- vet/static analysis;
- frontend typecheck/tests;
- API integration;
- DB migration tests;
- auth security regression;
- media migration verification;
- ARM64 Docker builds;
- browser QA;
- performance/resource measurement.

Do not call skipped gates PASS.

---

# Resource objective

Final steady state should ideally fit well below available RAM.

Target after Keycloak/Nest/MinIO removal:

```text
host/cache baseline          ~2.5–3.5 GB
Go API                       ~0.2–0.8 GB
Next learner                 ~0.8–1.2 GB (KEEP_NEXT_RUNTIME)
Admin                        ~0 if static (eval post-M6)
PostgreSQL                   ~2–3 GB
Redis                        ~0.2–0.6 GB
Meilisearch                  ~1.5–3 GB
Caddy                        <0.25 GB
Docker/logging               ~0.5–1 GB
large safety margin          desirable
```

Do not optimize from guesses; measure.

If Meilisearch features can be safely replaced by PostgreSQL FTS/pg_trgm without product regression, record that as a later optional optimization, not part of the mandatory migration.

---
