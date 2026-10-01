# OCI ARM64 Production Validation Report

**Date:** 2026-10-01
**Host:** kotobawork-prod (161.33.172.129)
**Architecture:** aarch64 (ARM64) — verified via `uname -m` and container image manifests
**Branch:** main
**Production Candidate HEAD:** `b5957eb9` (fix(deps): regenerate pnpm-lock.yaml after minio removal)
**Base Production Candidate:** `408812d1` (docs(orchestration): record MINIO_RUNTIME_REMOVAL_PASS and LEGACY_STACK_REMOVAL_PASS)

---

## Gate Results

| Gate | Status |
|------|--------|
| OCI_ARM64_RUNTIME_PASS | ✅ TRUE |
| OCI_PRE_DNS_PRODUCTION_READY | ✅ TRUE |
| ProductionCutover | PENDING (awaiting DNS/TLS inputs) |

---

## Host Evidence

| Property | Value |
|----------|-------|
| Hostname | kotobawork-prod |
| Kernel | Linux 6.17.0-1020-oracle aarch64 |
| Architecture | aarch64 (ARM64) |
| OCPUs | 4 |
| RAM | 23 GiB total, ~3.5 GiB used, ~19 GiB available |
| Boot Disk (/) | 48G total, 9.9G used, 38G free (21%) |
| Data Disk (/srv/kotobawork/data) | 147G total, 154M used, 139G free (1%) |
| Docker | 29.1.3 |
| Docker Compose | 2.40.3 |
| SSH Alias | kotobawork-prod (ubuntu@161.33.172.129) |

## Storage Layout

```
/srv/kotobawork/
├── repo/              # Git clone at b5957eb9
├── data/              # Dedicated ext4 data volume (/dev/sdb)
│   ├── postgres/      # PostgreSQL 17 data (fresh init)
│   ├── redis/         # Redis AOF persistence
│   ├── meilisearch/   # Meilisearch index (data.ms + dumps)
│   ├── media/         # Filesystem media storage
│   ├── backups/       # Backup target directory
│   ├── caddy-data/    # Caddy TLS certificate storage
│   └── caddy-config/  # Caddy autosave config
├── deploy/
│   └── oci/           # docker-compose.oci.yml, Caddyfile, .env.production (600)
└── runtime/
    └── Caddyfile      # Active Caddy config (bind-mounted into container)
```

Data disk mounted via fstab: `UUID=3b10de86-... /srv/kotobawork/data ext4 defaults,nofail,x-systemd.device-timeout=30s 0 2`

## Container Architecture Verification

All 7 containers confirmed running on `arm64` platform:

| Container | Image | Platform | Status | Memory |
|-----------|-------|----------|--------|--------|
| oci-api-1 | oci-api:latest | arm64 | Up | 69.96 MiB / 512 MiB |
| oci-web-1 | oci-web:latest | arm64 | Up | 65.88 MiB / 1 GiB |
| oci-admin-1 | oci-admin:latest | arm64 | Up | 64.97 MiB / 512 MiB |
| oci-postgres-1 | postgres:17-alpine | arm64 | Up (healthy) | 21.99 MiB / 2 GiB |
| oci-redis-1 | redis:8-alpine | arm64 | Up (healthy) | 6.26 MiB / 1 GiB |
| oci-meilisearch-1 | getmeili/meilisearch:v1.13 | arm64 | Up | 5.40 MiB / 4 GiB |
| oci-caddy-1 | caddy:2-alpine | arm64 | Up | 10.75 MiB / 256 MiB |

No NestJS, Keycloak, or MinIO containers present.

## Pre-DNS Smoke Tests

### Infrastructure Health
- **API `/health/ready`:** `{"checks":{"postgres":"ok","redis":"ok"},"status":"ok"}` ✅
- **Caddy `/health`:** HTTP 200 ✅
- **Learner Web `/vi`:** HTTP 200 ✅
- **Admin `/admin/`:** HTTP 200 (via Caddy) ✅
- **Anonymous `/api/auth/me`:** HTTP 401 ✅

### Auth Lifecycle (via Caddy on :80, Origin: http://161.33.172.129)
- **Register:** `{"userId":"9b6f716d-..."}` ✅
- **Login:** `{"ok":true,"token":"..."}` ✅
- **Authenticated `/api/auth/me`:** Full profile JSON returned ✅
- **Logout:** `{"ok":true}` ✅
- **Post-logout `/api/auth/me`:** HTTP 401 ✅

### Persistence Test (container restart)
- Restarted postgres, redis, meilisearch, api containers
- Post-restart API health: `{"status":"ok"}` ✅
- Post-restart relogin with existing credentials: `{"ok":true}` ✅
- PostgreSQL data survived restart ✅
- Meilisearch index directory persisted (`data.ms`) ✅
- Media directory persisted ✅

### Database Schema
- Prisma schema pushed successfully (23 schemas, 183 tables)
- Schemas: admin, analytics, assessment, auth, authz, career, content, curriculum, daily, exercise, gamification, growth, l10n, learning, legal, media, monetization, ops, profile

## Resource Observation

| Metric | Value |
|--------|-------|
| Data disk usage | 154M / 147G (1%) |
| Total memory used | 3.5 GiB / 23 GiB |
| Available memory | 19 GiB |
| Docker images | 15 total, 7 active, 10.65 GiB reclaimable |
| Build cache | 7.25 GiB (4.29 GiB reclaimable) |
| Swap | 0B (none configured) |

Healthy headroom confirmed. No risk of disk-full incident.

## Security Configuration

- `.env.production` permissions: `600` (owner read/write only)
- Secrets generated on-host via `openssl rand -hex` (no local exposure)
- `COOKIE_SECURE=false` (pre-DNS; must be set to `true` after HTTPS is active)
- CORS origins restricted to `http://161.33.172.129` (pre-DNS IP)
- Caddy listening on `:80` only (no TLS until public DNS)
- Host-level Caddy service disabled to prevent port conflict

## Issues Resolved During Deployment

1. **pnpm-lock.yaml mismatch** — Production candidate `408812d1` removed `minio` from `package.json` but lockfile was stale. Fixed in commit `b5957eb9`.
2. **Legacy GCP containers holding ports** — Stopped and removed all `gcp-*` containers that held ports 15432, 6379, 7700, 9000.
3. **Host-level Caddy on port 80** — Disabled systemd `caddy` service to free port for Docker Caddy.
4. **Stale PostgreSQL data** — Previous GCP stack's PG data had different credentials. Wiped and reinitialized with fresh production secrets.
5. **Docker group membership** — Added `ubuntu` user to `docker` group for non-root compose operations.
6. **Caddyfile mount type mismatch** — Docker auto-created a directory at `/srv/kotobawork/runtime/Caddyfile` when file was missing. Removed directory, copied actual file.

## Backup Readiness

- **PostgreSQL:** `pg_dump` via `docker exec oci-postgres-1 pg_dump -U postgres nihongo_bjt > /srv/kotobawork/data/backups/pg_$(date +%Y%m%d).sql`
- **Media:** `tar czf /srv/kotobawork/data/backups/media_$(date +%Y%m%d).tar.gz /srv/kotobawork/data/media/`
- **Configuration:** `.env.production` and `Caddyfile` backed up in `/srv/kotobawork/deploy/oci/`
- **Meilisearch:** Snapshot API or rebuild from source (indexes are reproducible from PostgreSQL data)

## Remaining External Inputs for DNS/TLS Cutover

To proceed to public DNS and TLS provisioning, the following inputs are required:

1. **Production domain(s)** — e.g., `kotobawork.com`, `app.kotobawork.com`, `admin.kotobawork.com`, `api.kotobawork.com`
2. **Current DNS provider** — Where existing records are managed (Cloudflare, Route53, etc.)
3. **Target OCI public IP:** `161.33.172.129`
4. **Proposed DNS record changes** — A records pointing production domains to OCI IP
5. **Caddy hostname configuration** — Update Caddyfile from `:80` catch-all to domain-specific HTTPS blocks
6. **Rollback DNS target** — Previous staging/GCP endpoint for fallback

Once these inputs are provided, Caddy auto-TLS will handle certificate provisioning automatically.