# Production Cutover Readiness Report

**Date:** 2026-09-30
**Status:** READY_FOR_PRODUCTION_CUTOVER
**Engineering Migration:** COMPLETE (M1–M17 accepted)
**Production Cutover:** PENDING (human authorization required)

---

## Current Git State

| Field | Value |
|---|---|
| Branch | `main` |
| ImplementationAcceptedHEAD | `94512f05` (M17 post-migration cleanup) |
| CurrentRepositoryHEAD | `ab7f31b0` (M17 state commit) |
| Working tree | Clean |
| Last engineering wave | M17_POST_MIGRATION_CLEANUP PASS |

No uncommitted changes. No history rewrite performed.

---

## Engineering Migration Summary

All 17 autonomous migration waves (M1–M17) have been accepted:

- **M0:** Repository truth, API contract matrix, route/input/output validation
- **M1:** Go foundation (chi + pgx, config validation, health endpoints, ARM64 Docker)
- **M2:** Auth/session persistence schema (4 tables in `auth` schema, CHECK constraints)
- **M3:** First-party Argon2id credentials, HTTP session guards, CSRF, rotation/authz, 23 endpoint tests
- **M4–M6:** Account lifecycle, learner profile, admin RBAC
- **M7–M9:** Media/storage architecture, content migration, search/Meilisearch projection
- **M10:** Background jobs (Redis/BullMQ → Go-native)
- **M11:** Remaining integrations (billing, analytics, notifications)
- **M12:** Realtime (Socket.IO battle/presence → Go WebSocket)
- **M13a/b/c:** Auth migration — learner web, admin, mobile migrated from Keycloak to Go-native sessions
- **M14:** Frontend static audit and optimization
- **M15:** NestJS API disabled from active runtime (Caddy routes to Go :4001)
- **M16:** Runtime optimization (Alpine 3.21, binary stripped, .dockerignore)
- **M17:** Post-migration cleanup (dead NestJS artifacts removed, Caddy Keycloak proxy retired)

**Identity reset decision:** `IDENTITY_RESET_APPROVED = TRUE`. Legacy Keycloak credential format investigation closed as NOT_REQUIRED.

---

## Target Runtime

| Component | Technology | Port | Status |
|---|---|---|---|
| Go API | Go 1.23 + chi + pgx | :4001 | ACTIVE_TARGET |
| Learner Web | Next.js (Node) | :3000 | ACTIVE_TARGET |
| Admin | Next.js static export / Node | :3001 | ACTIVE_TARGET |
| Mobile | React Native / Expo | N/A | ACTIVE_TARGET |
| PostgreSQL | 17-alpine | :15432 (host) | ACTIVE_TARGET |
| Redis | 8-alpine | :6379 (host) | ACTIVE_TARGET |
| Meilisearch | v1.13 | :7700 (host) | ACTIVE_TARGET |
| Caddy | Reverse proxy | :80/:443 | ACTIVE_TARGET |
| Media storage | LocalFS (`fileblob`) | Served via Caddy | ACTIVE_TARGET |

---

## Services Pending Final Retirement

| Service | Current Status | Action at Cutover |
|---|---|---|
| Keycloak | CUTOVER_PENDING | Disable after Go auth verified in production |
| Keycloak DB | CUTOVER_PENDING | Disable with Keycloak; delete after stability window |
| MinIO | DISABLED_ROLLBACK_AVAILABLE | Already replaced by LocalFS; delete data after stability window |
| NestJS API | DISABLED_ROLLBACK_AVAILABLE | Already removed from Caddy/ecosystem; delete after stability window |

---

## Production Data Backup Preconditions

Before executing any destructive cutover step:

1. **Full PostgreSQL dump** of `nihongo_bjt` database (all schemas: `content`, `auth`, `authz`, `profile`)
   ```bash
   pg_dump -h 127.0.0.1 -p 15432 -U postgres -d nihongo_bjt --format=custom --file=/backup/nihongo_bjt_pre_cutover.dump
   ```
2. **Verify backup restorability** on a disposable PostgreSQL instance
3. **Record row counts** for all identity/account-scoped tables before reset
4. **Inventory foreign keys** referencing `auth.*` and `profile.*` tables
5. **Preserve Keycloak realm export** (`docker/keycloak/realm-export.json` already in repo)
6. **Snapshot MinIO bucket** if any media objects remain unverified against LocalFS

---

## Identity Reset Scope

### Reset (disposable):
- All Keycloak users, credentials, sessions, and tokens
- `auth.password_credential`, `auth.admin_password_credential`
- `auth.session`, `auth.admin_session`
- Account-scoped application data: personal profiles, learning progress, history, notifications, analytics events tied to user accounts

### Preserve (non-disposable):
- Authored BJT questions, vocabulary, curriculum, exercise definitions
- Media/audio/images and their provenance metadata
- Search source content and Meilisearch indexes
- Product configuration, plans, entitlements, quotas
- Non-user reference data (categories, tags, locales)
- Legacy Keycloak subject columns (remain nullable/unused; do NOT drop at cutover)

---

## Bootstrap Admin Procedure

After identity reset, create the first admin account using the Go bootstrap tool:

```bash
cd apps/api-go
./bootstrap-admin \
  --email="admin@example.com" \
  --password="<strong-password>" \
  --name="System Administrator"
```

This creates entries in `auth.admin_password_credential`, `authz.admin_actor`, and `profile.user_profile` atomically. Verify with:

```bash
curl -c cookies.txt -X POST https://api.__DOMAIN__/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"<strong-password>"}'

curl -b cookies.txt https://api.__DOMAIN__/api/admin/session
```

---

## Production Deployment Procedure

1. **Pull latest code** at `94512f05` or later
2. **Run `deploy/gcp/prepare-runtime.sh`** to generate fresh secrets and `.env`
3. **Start infrastructure:** `docker compose -f deploy/gcp/compose.infrastructure.yml up -d`
4. **Wait for health checks:** PostgreSQL, Redis, Meilisearch all report healthy
5. **Build and start Go API:** `docker build -t kotobawork-api:latest apps/api-go/ && docker run -d --name api -p 4001:4001 --env-file .env kotobawork-api:latest`
6. **Build and start frontends:** via PM2 ecosystem config (`deploy/gcp/ecosystem.config.cjs`)
7. **Generate and install Caddyfile:** `sed "s/__BASE_DOMAIN__/$BASE_DOMAIN/g" deploy/gcp/Caddyfile.template > /etc/caddy/Caddyfile && systemctl reload caddy`
8. **Verify health endpoints:**
   - `GET /api/health/live` → 200
   - `GET /api/health/ready` → 200 (confirms DB + Redis connectivity)

---

## Database Migration Procedure

The Go migration uses additive-only Prisma migrations in the `auth` schema. On a fresh or existing production database:

```bash
cd packages/database
pnpm prisma migrate deploy
```

If the historical migration `20260425020754_phase_00_data_import` fails (PRE_EXISTING issue), it is safe to baseline past it on an existing production database that already has the content schema. The M2 auth schema migrations are independently verified on fresh PostgreSQL 17.

---

## Media Verification

1. **Confirm LocalFS media directory** exists at `/srv/kotobawork/data/media` with correct permissions
2. **Verify public media access:** `curl -I https://media.__DOMAIN__/path/to/public/image.jpg` → 200
3. **Verify private media authorization:** authenticated request through Go API returns signed/streamed content; unauthenticated request returns 401/403
4. **Verify HTTP Range support for audio:** `curl -H "Range: bytes=0-1023" https://media.__DOMAIN__/path/to/audio.mp3` → 206 Partial Content
5. **Cross-check object inventory** against any remaining MinIO bucket contents (if applicable)

---

## Keycloak Final Disable Procedure

**Execute ONLY after all smoke tests pass with Go-native auth.**

1. Stop Keycloak container: `docker compose -f deploy/gcp/compose.infrastructure.yml stop keycloak keycloak-db`
2. Remove Keycloak from Caddy template (already done in M17 — `auth.__DOMAIN__` block retired)
3. Remove Keycloak env vars from `prepare-runtime.sh` (already done in M17)
4. **Do NOT delete Keycloak DB volume or realm export** until stability window completes
5. Monitor for 72 hours minimum before proceeding to deletion

---

## MinIO Final State

MinIO is already replaced by LocalFS (`gocloud.dev/blob/fileblob`). The MinIO container definition remains in `compose.infrastructure.yml` for rollback only.

**At cutover:** Stop MinIO container if still running.
**After stability window:** Remove MinIO container definition and delete `/srv/kotobawork/data/minio` volume.

---

## NestJS Final State

NestJS API (`apps/api/`) is disabled from active runtime since M15. Caddy routes all API traffic to Go :4001. The `apps/api/` directory is preserved on disk for rollback reference only.

**At cutover:** No action needed (already disabled).
**After stability window:** Delete `apps/api/` directory and remove from repository.

---

## Smoke Tests

Execute ALL of the following after deployment and before declaring cutover success:

### Authentication
- [ ] Learner registration (email/password)
- [ ] Learner login → session cookie returned
- [ ] Learner `/api/auth/me` → correct profile
- [ ] Learner logout → session revoked
- [ ] Admin login → admin session cookie
- [ ] Admin `/api/admin/session` → correct actor + permissions
- [ ] Admin logout → admin session revoked
- [ ] Mobile Bearer token auth (if supported)
- [ ] Google OAuth flow (if configured)
- [ ] Disabled account rejected at login
- [ ] Expired/revoked session rejected

### Core Learning Flow
- [ ] BJT quiz load → questions returned with reading assist metadata
- [ ] BJT quiz submit → score recorded, progress updated
- [ ] Flashcard deck browse → cards returned
- [ ] Flashcard review session → SRS scheduling applied
- [ ] Reading assist hover/tap → furigana + meaning displayed
- [ ] Saved items list → correct user-scoped results

### API Health
- [ ] `GET /api/health/live` → 200
- [ ] `GET /api/health/ready` → 200
- [ ] CORS headers correct for app/admin domains
- [ ] CSRF token validation working

### Media
- [ ] Public image upload via admin → stored in LocalFS
- [ ] Public image read via Caddy → 200, correct Content-Type
- [ ] Private media read with auth → streamed correctly
- [ ] Private media read without auth → 401/403
- [ ] Audio HTTP Range request → 206 Partial Content
- [ ] Media provenance/license metadata preserved

### Search
- [ ] Meilisearch index populated after content seed
- [ ] Search query returns relevant results
- [ ] Search respects locale filter

### Background Jobs
- [ ] BullMQ/Redis job enqueue → processed by Go worker
- [ ] Failed job retry logic working
- [ ] Job completion updates database state

### Billing
- [ ] Webhook endpoint reachable and signature-verified
- [ ] Entitlement/quota enforcement on gated features
- [ ] Plan upgrade/downgrade reflected immediately

### Realtime
- [ ] WebSocket connection established for battle
- [ ] Battle match creation → both players notified
- [ ] Presence update broadcast to room members
- [ ] Socket reconnection after network interruption

---

## Restart/Reboot Verification

After all smoke tests pass, verify persistence survives restart:

1. **Restart Go API container** → health endpoints recover within 30s
2. **Restart PostgreSQL** → sessions and credentials survive; no data loss
3. **Restart Redis** → ephemeral caches rebuild; persistent queues survive (AOF enabled)
4. **Restart Meilisearch** → indexes intact, search functional
5. **Full server reboot** → all services auto-restart via systemd/docker restart policies
6. **Verify learner session** created before reboot still valid after reboot
7. **Verify admin session** created before reboot still valid after reboot

---

## Resource Verification

Confirm resource budget is acceptable under expected load:

| Resource | Budget | Verification Command |
|---|---|---|
| Go API memory | < 256 MB | `docker stats api --no-stream` |
| Go API CPU | < 50% single core at idle | `docker stats api --no-stream` |
| PostgreSQL memory | ≤ 1 GB (compose limit) | `docker stats postgres --no-stream` |
| Redis memory | ≤ 768 MB (maxmemory set) | `redis-cli -a $REDIS_PASSWORD INFO memory` |
| Meilisearch memory | ≤ 4 GB (compose limit) | `docker stats meilisearch --no-stream` |
| Disk (media) | Sufficient for projected growth | `df -h /srv/kotobawork/data/media` |
| Disk (postgres) | Sufficient for DB + WAL | `df -h /srv/kotobawork/data/postgres` |
| Docker process health | All containers running | `docker ps --format '{{.Names}} {{.Status}}'` |
| Binary size | ~20 MB (stripped ARM64) | `ls -lh apps/api-go/api-server` |

---

## Rollback Procedure

### When to rollback:
- Smoke tests fail after cutover and cannot be fixed within the maintenance window
- Critical data loss or corruption detected
- Go API crashes repeatedly under production load
- Auth system produces incorrect authorization decisions

### Rollback steps:

1. **Restore Caddy to route API traffic to NestJS :4000:**
   ```
   api.__BASE_DOMAIN__ {
       reverse_proxy 127.0.0.1:4000
   }
   ```
2. **Re-enable Keycloak** in `compose.infrastructure.yml` and start containers
3. **Restore Keycloak realm** from `docker/keycloak/realm-export.json` if needed
4. **Restart NestJS API** via PM2: `pm2 start ecosystem.config.cjs --only nihongo-api`
5. **Restore database** from pre-cutover backup if data was modified destructively:
   ```bash
   pg_restore -h 127.0.0.1 -p 15432 -U postgres -d nihongo_bjt --clean --if-exists /backup/nihongo_bjt_pre_cutover.dump
   ```
6. **Verify legacy auth flow** works end-to-end before declaring rollback complete

### What NOT to destroy during rollback:
- Go API binary and Docker image (keep for re-attempt)
- `auth` schema tables (additive; do not conflict with legacy auth)
- Migration reports and orchestration state
- LocalFS media (compatible with both runtimes)

---

## Stability Window

**Minimum duration:** 72 hours of production operation with zero critical incidents.

**Evidence required before deleting legacy artifacts:**

| Artifact | Deletion Condition |
|---|---|
| Keycloak DB volume | 72h stable + confirmed no auth fallback needed |
| Keycloak realm export file | 72h stable + new admin bootstrap verified |
| Keycloak container definition | 72h stable + compose.infrastructure.yml cleaned |
| MinIO data volume | 72h stable + media inventory cross-checked |
| MinIO container definition | 72h stable + compose.infrastructure.yml cleaned |
| `apps/api/` directory | 72h stable + no rollback invoked |
| NestJS PM2 process entry | Already removed in M17 |
| Legacy Keycloak env vars | Already removed in M17 |

**Deletion sequence:** Disable first → monitor stability window → delete second. Never delete without a verified disable-first period.

---

## Cutover Gate Classification

### ✅ READY_FOR_PRODUCTION_CUTOVER

All engineering prerequisites are met:
- Go API fully implemented and tested (M1–M17 accepted)
- Auth migration complete for learner web, admin, and mobile (M13a/b/c)
- NestJS disabled from active runtime (M15)
- Dead artifacts cleaned (M17)
- Deployment templates updated (Caddy, ecosystem, prepare-runtime)
- Identity reset approved and scoped
- Bootstrap admin tool available
- Rollback procedure documented and non-destructive
- Service retirement states classified accurately

### Remaining human gates:
1. **Production cutover authorization** — explicit go-ahead from project owner
2. **Production environment access** — credentials/SSH for target deployment host
3. **DNS/domain configuration** — ability to update Caddy TLS certificates and domain routing
4. **Backup execution** — pre-cutover database snapshot must be taken and verified
5. **Google OAuth production credentials** — if social login is required at launch (M4 gated unknown)

### Not ready conditions (NONE currently blocking):
- No engineering blockers remain
- No test failures blocking cutover
- No missing implementation for core flows

---

## Final Done Definition

OverallStatus may become `DONE` only after:

1. Production cutover executed and authorized
2. Go stack healthy in production for ≥72 hours
3. New auth (Go-native sessions) verified healthy for all client types
4. Keycloak stopped and confirmed no longer required
5. MinIO stopped and confirmed no longer required
6. NestJS stopped and confirmed no longer required
7. Persistence survives restart/reboot verification
8. All critical browser/API/realtime/media smoke tests pass in production
9. Rollback evidence exists and was tested (or deemed unnecessary after stability window)
10. Resource budget acceptable under observed production load
11. Legacy artifacts deleted per stability window protocol

Until all 11 conditions are met, OverallStatus remains `READY_FOR_PRODUCTION_CUTOVER`.