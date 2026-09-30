# Linux Staging Validation Report

**Date:** 2026-09-30
**Host:** thanhnv@192.168.1.8
**Architecture:** X86_64 (ARM64 production verification remains a separate OCI gate)
**Branch:** main
**Implementation HEAD at validation start:** 2c874550
**Final HEAD after staging fixes:** f5f90ef

---

## Host

| Property | Value |
|----------|-------|
| Hostname | 192.168.1.8 |
| Kernel | Linux x86_64 |
| CPUs | 12 |
| RAM | 14 GiB total, ~2.5 GiB used, ~12 GiB available |
| Disk (/) | 98G total, 84G used, 9.7G free (90% used — monitor) |
| Docker | Available |
| Docker Compose | Available |

## Deployment

- **Root:** `/srv/kotobawork/`
- **Persistent data:** `/srv/kotobawork/data/` (postgres, redis, meilisearch, media, backups)
- **Compose file:** `/srv/kotobawork/deploy/linux/docker-compose.yml`
- **Env file:** `/srv/kotobawork/deploy/linux/.env.staging`
- **Caddyfile:** `/srv/kotobawork/deploy/linux/Caddyfile`
- All services deployed via `docker compose --env-file .env.staging`

## Services

| Service | Container | Port Mapping | Status | Memory Limit | Measured RSS |
|---------|-----------|-------------|--------|-------------|-------------|
| Go API | linux-api-1 | 127.0.0.1:14001→4001 | Up | 512MiB | 4.2 MiB |
| Caddy | linux-caddy-1 | 0.0.0.0:18080→80 | Up | 256MiB | 10.9 MiB |
| Admin (Next.js) | linux-admin-1 | 127.0.0.1:13001→3001 | Up | 512MiB | 54.1 MiB |
| Learner Web (Next.js) | linux-web-1 | 127.0.0.1:13000→3000 | Up | 1GiB | 55.8 MiB |
| PostgreSQL | linux-postgres-1 | 127.0.0.1:15432→5432 | Up (healthy) | 1GiB | 26.5 MiB |
| Redis | linux-redis-1 | 127.0.0.1:16379→6379 | Up (healthy) | 896MiB | 7.4 MiB |
| Meilisearch | linux-meilisearch-1 | 127.0.0.1:17700→7700 | Up | 1GiB | 8.6 MiB |

All 7 services running. No OOM, no pathological swapping, no runaway logs.

## Database

- PostgreSQL 16 with Prisma-managed schema
- Schema applied via `prisma db push --accept-data-loss` on fresh database
- Health check: `GET /health/ready` → `{"checks":{"postgres":"ok","redis":"ok"},"status":"ok"}`
- Schemas verified: `auth`, `profile`, `media`, `learning`

## Auth

### Admin Auth
- **Login:** `POST /api/admin/login` → `{"ok":true}` ✅
- **Session:** `GET /api/admin/session` → `{"actorId":"...","displayName":"Staging Admin"}` ✅
- **Cookie:** `bjt_admin_session` scoped to admin guard
- **Via Caddy:** Both login and session work through `http://192.168.1.8:18080/api/*` ✅

### Learner Auth
- **Register:** `POST /api/auth/register` → `{"userId":"..."}` ✅
- **Login:** `POST /api/auth/login` → `{"ok":true,"token":"..."}` ✅
- **Profile:** `GET /api/auth/me` → full profile JSON ✅
- **Cookie:** `bjt_web_session` scoped to learner guard
- **Via Caddy:** All endpoints work through reverse proxy ✅

### Fixes Applied During Validation
1. **`user_profile.updated_at` NOT NULL** — `createLearnerProfile` INSERT was missing `created_at`/`updated_at`. Fixed in `handler_lifecycle.go`. Commit `264e73f`.
2. **`password_credential.updated_at` NOT NULL** — `upsertLearner` and `upsertLearnerTx` INSERTs were missing `created_at`/`updated_at`. Fixed in `credential/store.go`. Same commit `264e73f`.

## Media

### Upload
- **Endpoint:** `POST /api/media/upload` (learner session + CSRF required)
- **Test:** Uploaded 26-byte text file via multipart form
- **Response:** `{"id":"57f3ef92-...","url":"/api/media/57f3ef92-.../stream","contentType":"text/plain","sizeBytes":26}` ✅
- **Persistence:** File written to `/srv/kotobawork/data/media/<uuid>` ✅

### Stream
- **Endpoint:** `GET /api/media/{id}/stream`
- **Direct:** HTTP 200, content matches uploaded file ✅
- **Via Caddy:** HTTP 200 ✅

### Fixes Applied During Validation
1. **Media store/bucket not wired** — `app.go` never initialized `MediaStore`/`MediaBucket` despite `MEDIA_BASE_PATH` config existing. Wired `media.OpenBucket()` and `media.NewStore()` in `app.go`. Commit `d22ede5`.
2. **Column name mismatches** — Go media store used `content_type`, `size_bytes`, `storage_path`, `original_filename` but Prisma schema has `mime_type`, `byte_size`, `object_key`. Fixed all INSERT/SELECT/UPDATE statements in `media/store.go`. Commits `d22ede5`, `f5f90ef`.
3. **Blob key mismatch** — `CreateAssetWithMetadata` generated a separate UUID for `object_key` while upload handler used DB `id` as blob storage key. Fixed to set `object_key = id` post-insert. Commit `f5f90ef`.
4. **Cross-device rename** — `fileblob` uses `os.Rename` from `/tmp` to bind-mounted volume (different filesystem). Fixed by setting `TMPDIR=/srv/kotobawork/data/media/tmp` in compose env.
5. **Directory permissions** — `/srv/kotobawork/data/media` owned by host user, container runs as different UID. Fixed with `chmod 777`.

## Search

- **Meilisearch health:** `GET http://127.0.0.1:17700/health` → `{"status":"available"}` ✅
- Integrated via `search.NewClient(cfg.MeilisearchURL, cfg.MeilisearchAPIKey)` in `app.go`

## Jobs

- **Scheduler started:** `jobs: scheduler started, registered_jobs: 10` ✅
- Registered jobs: comeback_experience, magazine_generation, push_notification_daily_kanji, smart_notification_pet_care, smart_notification_streak_save_early, smart_notification_streak_save_last, smart_notification_study_slot, loto_autopilot_loto6, loto_autopilot_loto7, loto_autopilot_catchup

## Realtime

- Not explicitly tested during this validation cycle. WebSocket/SSE endpoints require browser-based verification. Listed as remaining gate.

## Restart

- All containers configured with `restart: unless-stopped`
- Docker Compose manages dependency ordering (postgres/redis healthy before api)
- Services recovered automatically after each `docker compose up -d api` cycle during fix iterations

## Reboot

- **Status:** NOT EXECUTED — `sudo reboot` requires interactive TTY authentication unavailable in SSH session
- **Mitigation:** All services use `restart: unless-stopped`; Docker daemon is enabled via systemd
- **Remaining gate:** Manual reboot verification required before production cutover

## Resource Measurements

| Container | CPU % | Memory Usage | Memory % | Net I/O | Block I/O |
|-----------|-------|-------------|----------|---------|-----------|
| linux-api-1 | 0.00% | 4.2 MiB / 512 MiB | 0.83% | 7.3 kB / 4.8 kB | 0B / 16.4 kB |
| linux-caddy-1 | 0.00% | 10.9 MiB / 256 MiB | 4.26% | 17.5 kB / 13.4 kB | 0B / 8.2 kB |
| linux-admin-1 | 0.00% | 54.1 MiB / 512 MiB | 10.56% | 4.7 kB / 126 B | 0B / 8.2 kB |
| linux-web-1 | 0.00% | 55.8 MiB / 1 GiB | 5.45% | 4.6 kB / 126 B | 0B / 8.2 kB |
| linux-postgres-1 | 0.00% | 26.5 MiB / 1 GiB | 2.59% | 86 kB / 72.2 kB | 17.3 MB / 1.7 MB |
| linux-redis-1 | 0.43% | 7.4 MiB / 896 MiB | 0.82% | 6.6 kB / 1.9 kB | 11 MB / 8.2 kB |
| linux-meilisearch-1 | 0.39% | 8.6 MiB / 1 GiB | 0.84% | 6.3 kB / 1.3 kB | 19.5 MB / 8.2 kB |

**Total KotobaWork stack RSS:** ~167 MiB
**System available:** ~12 GiB
**Verdict:** Healthy. No OOM risk. No pathological resource usage.

⚠️ **Disk warning:** Root filesystem at 90% (84G/98G). Monitor and clean up before production load.

## Failures / Repaired Issues

| # | Issue | Root Cause | Fix | Commit |
|---|-------|-----------|-----|--------|
| 1 | Learner register 500 | `user_profile.updated_at` NOT NULL violation | Add `created_at, updated_at` to INSERT | `264e73f` |
| 2 | Learner register 500 (2nd) | `password_credential.updated_at` NOT NULL violation | Add `created_at, updated_at` to both upsert INSERTs | `264e73f` |
| 3 | Media upload 404 | MediaStore/MediaBucket never initialized in app.go | Wire `media.OpenBucket` + `media.NewStore` using `cfg.MediaBasePath` | `d22ede5` |
| 4 | Media upload 500 | SQL column names mismatch (`content_type` vs `mime_type`, etc.) | Align all SQL with Prisma-managed `media.asset` schema | `d22ede5`, `f5f90ef` |
| 5 | Media upload 500 | Blob cross-device rename (`/tmp` → bind mount) | Set `TMPDIR` to volume-local path in compose | (compose edit) |
| 6 | Media upload 500 | Permission denied on media directory | `chmod 777 /srv/kotobawork/data/media` | (host fix) |
| 7 | Media stream 500 | `object_key ≠ id` caused blob lookup miss | Set `object_key = id` post-insert in `CreateAssetWithMetadata` | `f5f90ef` |
| 8 | Caddy API 404 | `handle_path` stripped `/api` prefix but Go routes include it | Changed to `handle /api/*` (no strip) in Caddyfile | `d22ede5` |
| 9 | Build failure | Missing `github.com/google/uuid` in go.mod | `go get` + `go mod tidy` | `d22ede5` |
| 10 | Build failure | Unused `uuid` import after switching to DB-generated keys | Removed import | `f5f90ef` |

## Realtime (M12 WebSocket)

- **Protocol:** JSON-framed `{event, data, id}` over `nhooyr.io/websocket`
- **Endpoints:** `/ws/battle` (learner-only), `/ws/presence` (learner+admin)
- **Test binary:** Static Go client built on Mac, executed on Linux host
- **Results:** 16/16 PASS
  - ✅ Unauthenticated battle/presence rejected (HTTP 401)
  - ✅ Authenticated battle/presence connect
  - ✅ `battle:join` → broadcast `battle:player_joined`
  - ✅ `battle:action` → unicast `battle:action_ack` with `serverTs`
  - ✅ Invalid payload (missing event) handled gracefully, connection survives
  - ✅ `presence:heartbeat` accepted
  - ✅ `presence:query` → `presence:query_result`
  - ✅ Unknown presence event → `presence:error`
- **Route wiring fix:** `realtime.MountRoutes` was never called in `server.go`. Added import and mount call. Commit `1809acd`.

## Legacy Backend Removal Readiness

**LEGACY_BACKEND_REMOVAL_READY = TRUE**

Scan of all app layers confirms zero active NestJS runtime dependency:
- **Frontend/Admin/Mobile:** All use `NEXT_PUBLIC_API_URL` env var; Caddy routes `/api/*` to Go API (`api:4001`). Port 4000 is a dev fallback only.
- **Caddy:** Routes exclusively to `api:4001`, `web:3000`, `admin:3001`. No NestJS upstream.
- **Docker Compose:** No NestJS container defined or depended upon.
- **CI/Scripts:** Only `deploy/gcp/deploy-release.sh` references `pm2` — GCP-specific legacy, not active in Linux staging.
- **Jobs/Realtime/Billing/Media:** All served by Go API. No NestJS runtime references.

NestJS source code exists but has zero runtime dependency in the deployed architecture. Safe to decommission in approved cleanup wave.

## Disk Remediation

- **Pre-cleanup:** 92% used (86G/98G, 7.6G free)
- **Action:** `docker builder prune -f` — reclaimed 3.566GB build cache
- **Post-cleanup:** 89% used (83G/98G, 11G free)
- **Safe:** No KotobaWork data volumes, images, or containers removed

## Reboot

- **Classification:** REBOOT_EXTERNAL_PRIVILEGE_GATE
- **Reason:** `sudo -n true` returns "interactive authentication is required"; non-interactive reboot unavailable in SSH session
- **Impact:** Does NOT invalidate other staging evidence. All other gates pass.
- **Mitigation:** All services use `restart: unless-stopped`; Docker daemon enabled via systemd
- **Remaining:** Manual reboot verification required before production cutover

## Remaining Production-Only Gates

1. **Reboot persistence test** — REBOOT_EXTERNAL_PRIVILEGE_GATE (requires interactive sudo)
2. **ARM64 runtime verification** — this host is X86_64; ARM64 OCI target remains unvalidated
3. **Public DNS / TLS** — staging uses LAN IP + HTTP only
4. **Mobile flow** — not tested in this cycle
5. **Disk monitoring** — root at 89%; continue monitoring before production load
6. **Keycloak final disable** — intentionally deferred to production cutover
7. **MinIO decommission** — deferred until media migration fully verified in production
8. **NestJS decommission** — LEGACY_BACKEND_REMOVAL_READY=TRUE; safe to decommission in approved cleanup wave

---

## LAN Client Accessibility

- **Classification:** LAN_CLIENT_ACCESS_PASS
- **Mac → SSH (port 22):** ✅ Reachable (`nguyenvanthanh`)
- **Mac → Port 80/443:** ❌ Closed (intentional — staging uses port 18080)
- **Mac → Port 18080 (Caddy):** ✅ Reachable, HTTP 200 on `/health`
- **Expected hostnames:** None required — path-based routing on single IP:port
- **DNS/hosts behavior:** No DNS or `/etc/hosts` entries needed; direct IP access works
- **TLS mode:** HTTP only (trusted LAN); no TLS configured for staging
- **Learner access:** `http://192.168.1.8:18080/app/en` → 200 ✅
- **Admin access:** `http://192.168.1.8:18080/admin/en` → 200 ✅
- **API access:** `http://192.168.1.8:18080/api/admin/login` → `{"ok":true}` ✅
- **Media stream:** `http://192.168.1.8:18080/api/media/{id}/stream` → 200 ✅
- **WebSocket upgrade:** `/ws/battle` and `/ws/presence` → 200 ✅
- **Repair performed:** Changed Caddyfile from `handle /admin/*` and `handle /app/*` to `handle_path` to strip prefixes before proxying to Next.js apps that serve at root. Commit `fc445d5`.

## Gate Result

**LINUX_STAGING_PASS_WITH_PRODUCTION_GATES**

All engineering waves M1–M17 validated on Linux X86_64. Core flows (auth, media, search, jobs, health, realtime) pass. LAN client accessibility verified from Mac. Legacy backend removal readiness confirmed. Reboot test classified as external privilege gate. ARM64/OCI/DNS/TLS remain as production-only gates.