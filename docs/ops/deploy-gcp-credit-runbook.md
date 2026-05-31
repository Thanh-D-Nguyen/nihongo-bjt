# NihonGo BJT - Google Cloud credit deployment runbook

## Goal

Deploy the current NihonGo BJT modular monolith on Google Cloud using the
USD 300 trial credit efficiently, while keeping the stack portable to a
lower-cost VM after the trial.

## Architecture decision

Start with one Compute Engine VM. Do not introduce managed services until
runtime measurements justify the additional monthly cost.

| Resource | Initial choice | Reason |
| --- | --- | --- |
| Region | `asia-southeast1` (Singapore) | Good latency for Vietnam and acceptable latency for Japan |
| VM | `e2-standard-2` | `2 vCPU`, `8 GB RAM`; cost-efficient starting point for the complete single-node stack |
| Provisioning model | Standard | PostgreSQL and Keycloak must not run on a reclaimable Spot VM |
| OS | Ubuntu `24.04 LTS` x86_64 | Matches the existing operations guide and broad Docker image support |
| Boot disk | `pd-balanced`, `80 GB` | Enough for OS, repository, build output, Docker images, and initial data |
| Network exposure | `22`, `80`, `443` only | Internal services bind to loopback or the Docker network |
| Runtime | Docker for infrastructure, PM2 for apps, Caddy for reverse proxy | Matches the repository's existing production guide |

Expected services on the VM:

- PostgreSQL 17: canonical source of truth.
- Redis 8: BullMQ and realtime coordination.
- Meilisearch: rebuildable search projection.
- MinIO: initial S3-compatible media store.
- Keycloak: OIDC provider.
- NestJS API, learner Next.js app, and admin Next.js app.
- Caddy: reverse proxy and TLS termination.

## Cost guardrails

- Create a project budget alert before or immediately after VM creation.
- Keep one VM only during the trial.
- Do not enable GPUs, premium images, external load balancers, Cloud NAT, or
  managed databases during the initial deployment.
- Keep `pd-balanced` at `80 GB`; expand only after checking disk usage.
- Keep the initial daily disk snapshot schedule while validating database backups.
- Review Billing reports weekly.

## Deployment log

### Checkpoint 0 - Local audit

Status: completed on 2026-05-30.

- Read `AI_CONTEXT.md`, mandatory production-first instructions, active Cursor
  rules, `docs/spec/index.md`, compact architecture and operations specs.
- Confirmed the repository is a monorepo with learner web, admin web, NestJS
  API, PostgreSQL, Redis, Meilisearch, MinIO, Socket.IO, BullMQ, and Keycloak.
- Confirmed the repository currently has local `docker-compose.yml`, but no
  committed production Dockerfiles for the application processes.
- Reuse the existing production direction documented in
  `docs/ops/deploy-digitalocean-step-by-step.md`: infrastructure containers,
  PM2 application processes, and Caddy.
- Local `gcloud` CLI is not authenticated. Provision resources from the
  authenticated Google Cloud Console and use SSH after VM creation.

### Checkpoint 1 - Google Cloud project and billing safety

Status: completed on 2026-05-30.

Target project from the authenticated console:

```text
project-dbd1d70a-52b4-4f92-acd
```

Actions completed:

1. Confirmed billing is active with `¥47,867` trial credit expiring on
   2026-08-29.
2. Created `Nihongo BJT Trial Guardrail` with thresholds at 50%, 75%, 90%,
   and 100%, including project owner email notifications.
3. Enabled the Compute Engine API.

### Checkpoint 2 - VM provisioning

Status: completed on 2026-05-30.

Create:

```text
name: nihongo-bjt-prod
region: asia-southeast1
machine: e2-standard-2
os: Ubuntu 24.04 LTS x86_64
boot disk: pd-balanced 80 GB
network tags: http-server, https-server
firewall: allow SSH, HTTP, HTTPS
```

Record after creation:

```text
zone: asia-southeast1-c
external_ipv4: 34.87.55.1
internal_ipv4: 10.148.0.2
estimated_monthly_cost: USD 69.15 plus snapshot storage
```

Google Cloud selected zone `asia-southeast1-c`. The initial daily snapshot
schedule runs between 19:00 and 20:00 with storage location `asia`.

### Checkpoint 3 - Server bootstrap

Status: completed on 2026-05-30.

Install:

```text
git curl unzip ufw fail2ban Docker Docker Compose Node.js 22 pnpm PM2 Caddy
```

Create a non-root `deploy` user and clone the repository under:

```text
/home/deploy/nihongo-bjt
```

Installed versions:

```text
Node.js: v22.22.2
pnpm: 10.26.2
Docker: 29.1.3
Docker Compose: 2.40.3
swap: 4 GB
```

Enabled `ufw` with inbound SSH, TCP `80`, and TCP `443` only. Enabled
`fail2ban`, Docker, and Caddy at boot.

### Checkpoint 4 - Infrastructure services

Status: completed on 2026-05-30.

Start PostgreSQL, Redis, Meilisearch, MinIO, and Keycloak with production
credentials. Bind internal service ports to `127.0.0.1`.

Infrastructure is defined in `deploy/gcp/compose.infrastructure.yml`.
Credentials are generated on the VM by `deploy/gcp/prepare-runtime.sh` and are
not committed. Keycloak uses a separate PostgreSQL container. Created private
MinIO bucket `nihongo-bjt-media`.

Run `deploy/gcp/configure-keycloak-user-admin.sh` after Keycloak is ready. It
creates an idempotent `nihongo-user-admin` service-account client with scoped
realm-management roles for server-side user lifecycle operations.

### Checkpoint 5 - Application deployment

Status: completed on 2026-05-30.

Apply Prisma migrations, seed the required foundation data, rebuild the search
projection, build the monorepo, and run API/web/admin with PM2.

- Applied all `80` Prisma migrations.
- Seeded `480` BJT questions, `301` Daily Radar cards, `306` magazine
  articles, and `88` Career RPG chapters.
- Rebuilt the Meilisearch projection. The current canonical dictionary tables
  contain no imported source documents, so the projection currently has zero
  content documents.
- Built API, learner web, and admin web successfully.
- Registered `nihongo-api`, `nihongo-web`, and `nihongo-admin` with PM2 and
  enabled `pm2-deploy.service` at boot.

### Checkpoint 6 - Routing, TLS, and verification

Status: completed on 2026-05-30.

Use real domains when available. Until then, use temporary `sslip.io` hostnames
derived from the VM external IPv4 address for Caddy TLS and smoke testing.

Promoted external IP `34.87.55.1` to attached static address
`nihongo-bjt-prod-ip`.

Temporary HTTPS URLs:

```text
learner:  https://app.34-87-55-1.sslip.io/vi
admin:    https://admin.34-87-55-1.sslip.io/vi
api:      https://api.34-87-55-1.sslip.io
keycloak: https://auth.34-87-55-1.sslip.io
```

Verify:

```text
GET /api/health/live
GET /api/health/ready
GET /api/health/version
learner web
admin web
Keycloak realm
Redis PING
Meilisearch /health
PostgreSQL pg_isready
```

All listed smoke tests returned healthy responses on 2026-05-30. API readiness
reported `status=ok` for database, Redis, search, media provider, and Keycloak
realm admin. Keycloak client-credentials token exchange returned HTTP `200`.
Learner username/password login was also verified through the browser after
PM2 was changed to load the production `.env` before launching each app.

### Checkpoint 7 - Backups

Status: completed on 2026-05-30.

- Google Cloud daily disk snapshot schedule is enabled.
- `deploy/gcp/backup-postgres.sh` writes compressed PostgreSQL dumps for the
  application and Keycloak databases under `/home/deploy/backups/postgres`.
- The VM crontab runs the backup daily at `10:30 UTC` and deletes dumps older
  than seven days.

## Remaining operator inputs

These can be supplied after the VM is running:

- Production domain, if already purchased.
- Google OAuth client credentials, if social login must be enabled immediately.
- Optional OpenAI, image search, email, and push notification provider keys.

## Operator quick reference

Connect:

```bash
ssh -i ~/.ssh/id_ed25519 deploy@34.87.55.1
cd /home/deploy/nihongo-bjt
```

Inspect and restart:

```bash
pm2 status
pm2 logs --lines 100
pm2 restart all
sudo docker compose \
  --env-file deploy/gcp/runtime/infrastructure.env \
  -f deploy/gcp/compose.infrastructure.yml ps
```

Run a manual backup:

```bash
./deploy/gcp/backup-postgres.sh
ls -lh /home/deploy/backups/postgres
```

Check public readiness:

```bash
curl -fsS https://api.34-87-55-1.sslip.io/api/health/ready
```

For Keycloak account management, routine publishing, GitHub Actions setup,
secrets handling, and the Jenkins decision, read
`docs/ops/gcp-keycloak-publish-cicd-guide.md`.
