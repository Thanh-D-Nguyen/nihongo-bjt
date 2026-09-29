# 06 — Execution Waves v2 (Rebaselined)

## Wave sequence

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

## M0 — Repository truth / detailed inventory

Deliver:

- repo inventory;
- API matrix (all 100 controllers);
- auth matrix (web, admin, mobile, realtime);
- DB ownership map;
- Keycloak dependency map (all clients including nihongo-mobile);
- MinIO/media inventory (buckets, keys, sizes, DB references);
- static-export audit for Admin (Web is KEEP_NEXT_RUNTIME);
- ARM64 dependency audit;
- baseline tests/builds;
- baseline resource snapshot;
- background job inventory (crons + BullMQ);
- realtime event inventory (Socket.IO gateways);
- Google OAuth production status;
- Sharp/image processing inventory;
- billing webhook inventory;
- application containerization audit.

Populate templates before any implementation.

## H0 — Documentation hygiene

Classify and propose cleanup based on P0 report.
Do not delete or move files without explicit approval.
GCP deployment docs remain as rollback reference until Oracle migration proven.

## M1 — Go foundation + deployment foundations

- Go module/service scaffold;
- config loading;
- live/readiness endpoints;
- structured logging (slog);
- PostgreSQL connection (pgx pool);
- Redis connection where needed;
- Docker ARM64 build verified;
- CI validates Go build/test;
- application containerization strategy documented;
- ARM64 production build/deployment strategy established.

Do NOT create unnecessary NestJS Dockerfiles.

## M2 — Identity/auth persistence + identity-reset decision

- Backward-compatible auth/session tables (additive);
- **Decision 2026-09-29**: `LEGACY_CREDENTIAL_MIGRATION = NOT_REQUIRED`; `IDENTITY_RESET_APPROVED = TRUE`;
- use fresh application-owned IDs and Argon2id credentials; no legacy password verifier;
- map account dependencies and prepare a backed-up, reviewed identity-only reset manifest before deletion;
- preserve non-user content/media and GCP rollback artifacts.

Do not delay M3 for production Keycloak credential metadata. Do not reset legacy identities until replacement auth and affected clients are verified.

## M3 — Auth core

- Login/logout/current user;
- session creation/revocation/rotation;
- Argon2id password hashing;
- CSRF defense;
- rate limiting;
- RBAC permission loading from PostgreSQL;
- admin authorization checks.

## M4 — Account lifecycle + Google OAuth

- Email verification;
- password reset (single-use tokens, expiry);
- password change;
- account disable/delete;
- registration (if applicable);
- Google OAuth decision: migrate if active, retire with documentation if inactive.

## M5 — Learner Web auth cutover

- Controlled migration from Keycloak to Go sessions;
- dual-cookie transition period with fixation protection;
- frontend route handler migration;
- session validation in layouts;
- rollback mechanism.

## M5.5 — Mobile auth cutover

- Flutter `nihongo-mobile` PKCE flow migrated to Go;
- token endpoint compatibility;
- refresh token behavior;
- custom redirect URI (`com.nihongobjt.app://oauth2redirect`) support;
- mobile integration testing.

See `docs/15_mobile_auth_migration.md`.

## M6 — Admin auth cutover

- RBAC proven before switching privileged workflows;
- admin session gating replaced;
- audit log continuity;
- rollback mechanism.

## M6.5 — Admin static-runtime evaluation

Evaluate whether Admin can become static export AFTER M6 proves Go auth works.
This is an optimization, not a prerequisite.
If viable, implement static export.
If not viable, retain Next.js runtime.

## M7 — BlobStore + media migration

Implement:

```text
BlobStore interface
→ gocloud.dev/blob/fileblob
→ /srv/kotobawork/data/media
```

Upload architecture (FINAL DECISION):

```text
Browser → Go API → streaming upload → temp file → validate → atomic rename → LocalFS
```

Requirements:

- stream, never buffer entire upload in RAM;
- enforce MaxBytesReader/equivalent size limits;
- validate filename/object key; prevent traversal;
- validate allowed content type; inspect actual content where appropriate;
- compute checksum where useful;
- clean partial/temp files after error;
- use safe atomic finalization;
- support cancellation;
- handle duplicate/retry semantics deliberately.

Media read paths:

- Public/cacheable: Browser → Caddy → `/srv/kotobawork/data/media/public`
- Private: Browser → Go API → auth → authorization → filesystem stream (`http.ServeContent`)

Migration steps:

1. Create migration inventory;
2. Copy MinIO objects without deleting source;
3. Validate count, size, checksum, content type, DB references, public/private classification;
4. Update application writes to use BlobStore;
5. Update reads to use BlobStore/Caddy as designed;
6. Configure Caddy `file_server` for public media root;
7. Implement Go authorized private media streaming;
8. Retain MinIO rollback.

Do NOT implement custom signed PUT URLs in Caddy.
Do NOT expose private media through Caddy file_server.
Do NOT introduce custom Caddy auth plugins during this migration.

See `docs/13_storage_architecture.md` and `docs/18_media_delivery_architecture.md`.

## M8 — Business read APIs

Low-risk/read-heavy domains.
Contract tests against Nest responses.

## M9 — Business write APIs

Transactional domains.
Preserve transaction boundaries.

## M10 — Background jobs / queue migration

Migrate all NestJS-embedded background work:

- ComebackExperienceCron
- MagazineGenerationCron
- LotoAutopilotCron
- PushNotificationCron
- SmartNotificationCron
- BullMQ workers (recommendation, revenge-mode, operations, analytics)

Select Go architecture based on M0 inventory (do not pre-commit to library).
Preserve timezone-aware scheduling (Asia/Ho_Chi_Minh).
Design duplicate-run protection for future multi-instance possibility.

See `docs/16_background_jobs_migration.md`.

## M11 — Remaining integrations

- Stripe/billing webhook migration (preserve exact signature verification and idempotency);
- Sharp/image processing replacement or retention decision;
- search orchestration closure;
- any remaining Nest-only dependencies.

## M12 — Realtime migration

Migrate Socket.IO gateways to WebSocket or compatible solution:

- BattleGateway (12+ events)
- PresenceGateway (heartbeat/query)
- Frontend socket.io-client consumers (7+ components)
- Connection authentication

Do NOT use SSE for Battle (bidirectional realtime).
Select protocol/library based on M0/M12 inventory.
NestJS may temporarily remain as realtime slice until this wave completes.

See `docs/17_realtime_migration.md`.

## M13 — Keycloak disable

Disable only after:

- zero active web dependency;
- zero admin dependency;
- zero mobile dependency (or explicitly retired with evidence);
- zero API/realtime token dependency;
- fresh Go credentials and account lifecycle validated; identity reset backed up, reviewed, and completed safely;
- role behavior proven;
- rollback window complete.

Disabled before deletion. Keep artifacts recoverable.

## M14 — MinIO disable

Disable only after:

- object reconciliation PASS;
- new upload PASS;
- old media access PASS;
- backup/rollback available;
- stability window complete.

Delete later with explicit approval.

## M15 — NestJS disable

Zero dependency required:

- zero route dependency;
- zero hidden job/worker dependency;
- zero webhook dependency;
- zero image processing dependency;
- zero realtime dependency;
- disabled successfully;
- stability window complete.

## M16 — Oracle runtime/resource optimization

Measure and tune actual production runtime.
Only after stability windows:

- remove old runtimes;
- remove stale config;
- delete legacy storage only with explicit approval;
- tune PostgreSQL, Redis, Meilisearch, Go memory;
- verify no OOM, no sustained swap, healthy reserves.

## Retirement ordering

Keycloak:

```text
all Web/Admin/Mobile/realtime auth migrated
→ disable
→ stability window
→ delete later
```

MinIO:

```text
all media write/read migrated
→ reconciliation/checksums
→ disable
→ stability window
→ delete later
```

NestJS:

```text
all HTTP APIs + jobs/workers + webhooks + image processing + realtime migrated
→ disable
→ stability window
→ delete later
```
