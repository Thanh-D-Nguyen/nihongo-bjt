# 12 — Definition of Done v2 (Rebaselined)

## Repository / architecture

- [ ] Actual repo topology documented.
- [ ] All NestJS responsibilities identified (100 controllers, 30+ modules).
- [ ] All Keycloak responsibilities identified (web, admin, mobile, realtime, Google OAuth).
- [ ] All MinIO/storage responsibilities identified (presigned PUT/GET, direct upload, admin upload).
- [ ] API matrix complete (all 100 controllers).
- [ ] Auth matrix complete (web, admin, mobile, realtime).
- [ ] Media inventory complete (buckets, keys, sizes, DB refs, public/private classification).
- [ ] DB ownership/migration boundary documented.
- [ ] Web runtime classified: KEEP_NEXT_RUNTIME.
- [ ] Admin runtime classified: NEEDS_INVESTIGATION_POST_M6.
- [ ] ARM64 audit complete.
- [ ] Background job inventory complete (5 crons + BullMQ workers).
- [ ] Realtime event inventory complete (BattleGateway 12+ events, PresenceGateway).
- [ ] Google OAuth production status determined.
- [ ] Sharp/image processing inventory complete.
- [ ] Billing webhook inventory complete.
- [ ] Application containerization audit complete.

## Go service

- [ ] Production Go API boots on ARM64.
- [ ] Graceful shutdown.
- [ ] Structured logs/request IDs (slog).
- [ ] PostgreSQL production-ready (pgx pool).
- [ ] Redis correct where required.
- [ ] Meilisearch integration correct.
- [ ] BlobStore abstraction implemented.
- [ ] `fileblob` backend production-ready.
- [ ] Streaming upload endpoint implemented (replaces presigned PUT).
- [ ] Authorized private media streaming implemented (http.ServeContent).
- [ ] ARM64 image verified.
- [ ] CI validates Go build/test.

## Auth replacement

- [ ] Login (web, admin, mobile).
- [ ] Logout.
- [ ] Current user.
- [ ] Argon2id password hashing (benchmarked on Oracle A1).
- [ ] Session expiry/revocation/rotation.
- [ ] Password reset (single-use tokens, expiry).
- [ ] Email verification if required.
- [ ] Registration if required.
- [ ] Disabled accounts.
- [ ] RBAC/permissions loaded from PostgreSQL.
- [ ] Admin authorization regression tested.
- [ ] CSRF defense.
- [ ] Rate limiting.
- [x] Legacy credential migration marked NOT_REQUIRED by explicit user decision (2026-09-29).
- [ ] Fresh first-party credentials and a safe first-admin bootstrap validated.
- [ ] Identity-only reset manifest, foreign-key inventory, row counts, backup and tested restore completed before destructive cleanup.
- [ ] Non-user content/media preserved across identity reset.
- [ ] Google OAuth migrated or explicitly retired with documentation.
- [ ] Mobile PKCE flow migrated and validated.
- [ ] Per-app cookie prefix isolation maintained during transition.

## Media migration

- [ ] Every MinIO bucket/key pattern classified.
- [ ] Object counts captured.
- [ ] DB references reconciled.
- [ ] Copy tool is idempotent.
- [ ] Size validation passes.
- [ ] Checksum validation passes where possible.
- [ ] Referenced-but-missing objects reported.
- [ ] Unreferenced objects reported, not auto-deleted.
- [ ] New uploads use BlobStore via streaming upload endpoint.
- [ ] Public media served by Caddy file_server.
- [ ] Private media served by Go with auth + authorization + streaming.
- [ ] Upload size/type enforcement validated.
- [ ] Path traversal prevention tested.
- [ ] MinIO rollback remains available through stability window.

## Frontend runtime

- [ ] Learner Web: KEEP_NEXT_RUNTIME confirmed (no static export attempted).
- [ ] Admin: static viability evaluated AFTER M6 auth cutover.
- [ ] Admin static export deployed only if post-M6 evaluation passes.
- [ ] No required SSR/server behavior silently lost.

## Business API

- [ ] Every production route classified.
- [ ] Every active route migrated or retired deliberately.
- [ ] Contract tests pass.
- [ ] Transactions preserved.
- [ ] Billing webhooks migrated with exact signature verification.
- [ ] Image processing migrated or retained with explicit decision.
- [ ] Background jobs migrated (crons + BullMQ workers).
- [ ] Realtime migrated (Socket.IO → WebSocket/compatible).
- [ ] Frontends no longer require NestJS for HTTP APIs.

## Retirement

### Keycloak
- [ ] Zero active web dependency.
- [ ] Zero admin dependency.
- [ ] Zero mobile dependency (or explicitly retired with evidence).
- [ ] Zero API/realtime token dependency.
- [ ] Password migration complete and validated.
- [ ] Role behavior proven.
- [ ] Rollback window complete.
- [ ] Disabled before deletion.

### MinIO
- [ ] Zero application dependency.
- [ ] Media reconciliation PASS.
- [ ] New upload PASS.
- [ ] Old media access PASS.
- [ ] Backup available.
- [ ] Rollback window complete.
- [ ] Disabled before deletion.

### NestJS
- [ ] Zero route dependency.
- [ ] Zero hidden job/worker dependency.
- [ ] Zero webhook dependency.
- [ ] Zero image processing dependency.
- [ ] Zero realtime dependency.
- [ ] Disabled successfully.
- [ ] Stability window complete.

## Security

- [ ] No secrets in Git.
- [ ] Cookie flags (Secure, HttpOnly, SameSite).
- [ ] CSRF defense.
- [ ] CORS/origin policy correct.
- [ ] Admin authorization enforced server-side.
- [ ] Reset-token replay prevented.
- [ ] Account enumeration reviewed.
- [ ] Postgres/Redis/Meilisearch private.
- [ ] Media path traversal tests pass.
- [ ] Upload limits enforced server-side.
- [ ] Public/private media separation verified.
- [ ] TLS via Caddy.
- [ ] Mobile PKCE validation verified.
- [ ] WebSocket connection authentication verified.
- [ ] Caddy security controls documented (admin IP restriction disposition).

## Oracle production

- [ ] ARM64 A1 verified.
- [ ] Restart after reboot verified.
- [ ] Persistent DB/search/media data on data volume.
- [ ] No normal OOM.
- [ ] No sustained swap.
- [ ] Healthy memory reserve.
- [ ] Disk/log growth controlled.
- [ ] Public media traffic does not traverse Go.
- [ ] Streaming upload within Go memory budget.
- [ ] Private media streaming within Go CPU/memory budget.
- [ ] Cost guardrails intact.

## Quality

- [ ] Go tests.
- [ ] vet/static checks.
- [ ] Race tests where suitable.
- [ ] Frontend affected tests.
- [ ] Typecheck.
- [ ] Production builds.
- [ ] API integration tests.
- [ ] Auth security regression.
- [ ] Media migration validation.
- [ ] Background job execution verified.
- [ ] Realtime connectivity verified.
- [ ] Critical browser journeys.
- [ ] Backup restore tested before destructive cleanup.

## Final evidence

```text
starting HEAD
final HEAD
commits
route migration summary
auth migration summary (web, admin, mobile)
media migration summary
DB migration summary
frontend runtime decisions
background job migration summary
realtime migration summary
billing webhook migration summary
image processing decision
test results
memory/CPU results
Oracle deployment state
rollback state
remaining debt
```
