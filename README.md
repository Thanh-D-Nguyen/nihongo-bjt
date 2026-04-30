# NihonGo BJT

Production-shaped monorepo for a BJT and daily Japanese learning platform.

Phase 00 data profiling and canonical import is complete and archived in `archive/phase-00-data-import/`. Active product development starts from Phase 01.

## Prerequisites

- **Node.js** 20+ (LTS recommended)
- **pnpm** 10+ (`corepack enable` then `corepack prepare pnpm@10.26.2 --activate`, or install via npm)
- **Docker** with Docker Compose (for local Postgres, Redis, Meilisearch, MinIO)

## Build and run (step by step)

### 1. Clone and enter the repo

```bash
git clone <your-remote> nihongo-bjt
cd nihongo-bjt
```

### 2. Start infrastructure services

```bash
docker compose up -d postgres redis meilisearch minio
```

Wait until Postgres is healthy (`docker compose ps`). The compose file maps **host `127.0.0.1:15432` → container `5432`** (see `docker-compose.yml`).

### 3. Environment variables

```bash
cp .env.example .env
```

Edit `.env` if needed:

- **`DATABASE_URL`** must point at your Postgres instance. For the default Docker stack, use the value from `.env.example` (`…127.0.0.1:15432/nihongo_bjt?schema=content`). The `?schema=content` suffix matches the Prisma multi-schema setup.
- If you use a **native Postgres on port 5432** instead, change `DATABASE_URL` accordingly (and run the same migrations against that database).
- **`MEILI_MASTER_KEY`** must match Meilisearch (`local_dev_meili_master_key` in compose).
- **Google OAuth**: `GOOGLE_OAUTH_*` can stay unset for flows that do not use Google. **`OAUTH_STATE_SECRET` must not be an empty string** (see **Troubleshooting** below).

### 4. Install dependencies and generate Prisma Client

```bash
pnpm install
pnpm prisma:generate
```

### 5. Apply database migrations

From the repo root (uses `DATABASE_URL` from `.env` via `prisma.config.ts`):

```bash
pnpm exec prisma migrate deploy --schema packages/database/prisma/schema.prisma
```

This creates all application schemas (`content`, `learning`, `profile`, etc.) and tables. Re-run after pulling migrations.

### 6. Optional: seed dev data (API)

With services still up and `.env` loaded:

```bash
pnpm --filter @nihongo-bjt/api admin:seed
pnpm --filter @nihongo-bjt/api monetization:seed
pnpm --filter @nihongo-bjt/api growth:seed
pnpm --filter @nihongo-bjt/api daily:seed
pnpm --filter @nihongo-bjt/api quiz:seed
```

Use only what you need; order is not strict except that **admin seed** is useful before testing the admin UI (`NEXT_PUBLIC_LOCAL_ADMIN_ACTOR_ID` in `.env`).

### 7. Optional: search index (Meilisearch)

Indexes a sample of content into the `content_search` index (dev convenience):

```bash
pnpm search:index
```

Search in the learner app works better after this; re-run when you change indexed fields or want fresher data.

### 8. Optional: lexeme pronunciation backfill (javi)

If you maintain `archive/phase-00-data-import/json/javi.json` and want `content.lexeme.pronunciation` populated without a full re-import:

```bash
pnpm data:backfill-lexeme-pronunciation
```

Use **`DATABASE_URL`** or **`DATABASE_URLS`** (pipe `|` separated) for multiple databases. Requires the `pronunciation` column migration to be applied first.

### 9. Run all apps in development

```bash
pnpm dev
```

This runs **Turbo** `dev` in parallel: learner web **:3000**, admin **:3001**, API **:4000** (see each app’s `package.json`).

### 10. Verify

- API liveness: `http://localhost:4000/api/health/live` (also `ready`, `version`)
- Learner: `http://localhost:3000/vi`
- Admin: `http://localhost:3001/vi`

### 11. Production-style build (compile check)

```bash
pnpm build
pnpm typecheck
```

Note: the API package’s `build` script is currently `tsc --noEmit` (typecheck only). Next.js apps emit under `.next/` when their `build` task runs.

### Troubleshooting (quick)

- **API env validation / `OAUTH_STATE_SECRET`**: `.env.example` includes `OAUTH_STATE_SECRET=""`. An empty string is invalid for the server schema. Remove that line or set a **dummy secret at least 32 characters** for local dev if you are not using Google OAuth yet.
- **`P1010` / DB connection**: Confirm `DATABASE_URL` matches your Postgres host, port, user, password, and database name; run `prisma migrate deploy` against the same URL the API uses.
- **Prisma Client out of date**: After `git pull`, run `pnpm prisma:generate` again.

## Stack

- Next.js App Router + TypeScript for learner and admin web apps.
- NestJS + TypeScript for the API.
- PostgreSQL + Prisma as the source of truth.
- Meilisearch for search projection.
- Redis + BullMQ for background jobs.
- Socket.IO for realtime battle flows.
- MinIO/S3-compatible object storage for media.

## Default service ports (reference)

| Service                   | URL / host                                                        |
| ------------------------- | ----------------------------------------------------------------- |
| Learner web               | `http://localhost:3000/vi`                                        |
| Admin web                 | `http://localhost:3001/vi`                                        |
| API health                | `http://localhost:4000/api/health/live` (also `ready`, `version`) |
| Postgres (Docker publish) | `127.0.0.1:15432` → container `5432`                              |
| Redis                     | `127.0.0.1:6379`                                                  |
| Meilisearch               | `http://localhost:7700`                                           |
| MinIO S3 API              | `http://localhost:9000`                                           |
| MinIO console             | `http://localhost:9001`                                           |

Database backup/restore: [docs/ops/backup-restore.md](docs/ops/backup-restore.md).

### MinIO and learner image uploads

Presigned `PUT` from the browser requires CORS on the MinIO bucket: allow the learner app origin (for example `http://localhost:3000`), methods `PUT` and `GET`, and the headers the client sends (including `Content-Type`). If uploads fail in the network tab with a CORS error, add or adjust a CORS rule in MinIO for your environment.

## Quality Gates

Run these after each phase:

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
# or (web dev already on :3000): pnpm test:e2e:local
pnpm prisma:validate
```

First-time E2E: `pnpm test:e2e:install` (or `pnpm exec playwright install chromium`).

- **`pnpm test:e2e`**: starts the learner dev server on port 3000 if nothing is serving that URL (typical in CI; requires a free port).
- **`pnpm test:e2e:local`**: does **not** start a server; use while `pnpm --filter @nihongo-bjt/web dev` is already running (avoids a second `next dev` in the same app, which Next.js rejects).

Pre-launch list: [docs/ops/launch-checklist.md](docs/ops/launch-checklist.md). Known gaps and backlog: [docs/product/known-limitations-and-backlog.md](docs/product/known-limitations-and-backlog.md).

## Phase Policy

Build smaller real vertical slices instead of broad demo screens. User-facing text must go through locale resources, backend-enforced RBAC is required for admin/sensitive workflows, and persisted domain data must live in PostgreSQL or an explicit provider-backed store.
