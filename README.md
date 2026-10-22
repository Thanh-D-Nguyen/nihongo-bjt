# KotobaWorks

Production-shaped monorepo for a BJT and daily Japanese learning platform.

Phase 00 data profiling and canonical import is complete and archived in `archive/phase-00-data-import/`. Active product development starts from Phase 01.

## Start the complete local system

Prerequisites: **Node.js 24.16.0**, **pnpm 12.15.0**, **Go 1.23+**, **Docker with Compose v2**, and **Caddy** on your PATH. Versions for Node/pnpm are pinned in `package.json`; Go's minimum version is in `apps/api-go/go.mod`.

From the repository root:

```bash
pnpm local:start
```

Or run `bash scripts/local-start.sh` directly. On macOS the script starts Docker Desktop from `/Applications/Docker.app` if its daemon is stopped; elsewhere, the local Docker engine must be running.

The command installs dependencies using the lockfile, creates `.env` from `.env.example` only if missing, checks application ports on IPv4 and IPv6, starts PostgreSQL/Redis/Meilisearch/Mailpit, generates Prisma Client, applies pending Prisma migrations, builds the Go API, and launches the API, learner, admin, and Caddy. It refuses a non-loopback `DATABASE_URL` and preserves existing `.env` files. It does not reset the database or seed content automatically.

Wait for **Ready!**, then open:

| Service            | URL                                   |
| ------------------ | ------------------------------------- |
| Learner            | http://localhost:18081/vi             |
| Admin login        | http://localhost:18081/admin/vi/login |
| API readiness      | http://localhost:18081/health/ready   |
| Local email inbox  | http://localhost:8025                 |
| Meilisearch health | http://localhost:7700/health          |

Caddy keeps the browser and API on the same origin. Auth uses Go-native sessions; Keycloak and the removed NestJS backend are not needed. Local media is stored in `tmp/local-audit/media`.

Keep this terminal open. **Ctrl-C** stops the API, web, admin and Caddy; Docker services keep running and database volumes persist. Logs are in `tmp/local-audit/{api,web,admin,caddy}.log`. The Go binary is rebuilt on each startup; restart after Go code changes. Next.js reloads frontend changes automatically.

In another terminal, check the running system:

```bash
pnpm local:status
# Optional: verify stability over 60 seconds
pnpm local:status --stable
```

For a fresh database, seed foundation/admin RBAC data separately:

```bash
pnpm seed:foundation
```

Additional content seeds are listed in `package.json`; `pnpm seed:all` imports the full seed set and may take a while. Seeded admin actors still need a supported authentication method; this startup command does not enable an authentication bypass.

To stop the Docker services later without deleting their data:

```bash
docker compose stop postgres redis meilisearch mailpit
```

### Troubleshooting

- **Missing tool:** install the prerequisite named in the error and retry. For Caddy on macOS, use `brew install caddy`.
- **Docker unavailable:** the script waits up to 120 seconds for Docker Desktop. Inspect Docker Desktop if it cannot become ready. A remote Docker context is not suitable for this local stack.
- **Port occupied:** inspect `lsof -nP -iTCP:<port> -sTCP:LISTEN` and stop the owning development server before retrying. The script never kills an existing listener. App ports are 3000, 3001, 4001, and 18081.
- **Database error:** the default Compose URL uses `127.0.0.1:15432/nihongo_bjt?schema=content`. Check `.env` and the migration error. The script stops on failure without resetting data.
- **Readiness timeout or app exit:** inspect the matching file in `tmp/local-audit/`. The command exits nonzero and stops the applications it launched.
- **Next.js cache errors after an interrupted run:** stop the apps, run `pnpm clean:next`, then retry `pnpm local:start`.

### Individual development commands

`pnpm dev` / `pnpm dev:web` starts only the learner on port 3000; `pnpm dev:admin` starts only admin on port 3001 (base path `/admin`). These commands do not start the Go API or infrastructure. Use `pnpm local:start` for the complete system.

The runtime backend is `apps/api-go` on port 4001. PostgreSQL/Prisma owns persistent data; Redis handles background work, Meilisearch is the search projection, and the Go API serves WebSocket realtime.

Database backup/restore: [docs/ops/backup-restore.md](docs/ops/backup-restore.md). Production checks: [scripts/quality/README.md](scripts/quality/README.md).

## Local dev accounts

These accounts are seeded for local development and testing. They do **not** have Keycloak/Google IdP links — use the local test bypass or auth link codes to log in.

### Learners

| Display Name | Email                 | User ID                                | Notes           |
| ------------ | --------------------- | -------------------------------------- | --------------- |
| Learner A    | `learner-a@local.dev` | `a1111111-1111-4111-8111-111111111111` | UI locale: `vi` |
| Learner B    | `learner-b@local.dev` | `b2222222-2222-4222-8222-222222222222` | UI locale: `ja` |
| Test User    | `test@test.com`       | `7e8ebed2-1af3-424d-94f0-169b24070ebc` | Legacy seed     |
| thanhnv11    | `thanhnv@rakumail.jp` | `12ae2af9-7fa9-435d-af73-df7c906b36fc` | Personal dev    |

### Admin

| Display Name       | Email             | Actor ID                               | Role          |
| ------------------ | ----------------- | -------------------------------------- | ------------- |
| Local Admin        | `admin@local.dev` | `c3333333-3333-4333-8333-333333333333` | `admin.super` |
| Default Seed Admin | _(seed default)_  | `00000000-0000-4000-8000-000000000001` | `admin.super` |

To use admin without Keycloak, set both `ADMIN_TEST_BYPASS=1` (API `.env`) and `NEXT_PUBLIC_ADMIN_TEST_BYPASS=1` (Admin `.env.local`), then restart both servers. Set `NEXT_PUBLIC_LOCAL_ADMIN_ACTOR_ID` to the actor ID above.

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
