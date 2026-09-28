# Repository Inventory

## Git

- Working directory: `/Users/thanhnguyen/Documents/Projects/nihongo-bjt`
- Branch: `main`
- Starting HEAD: `0fc4486f5cfd2edc4433359753be573605234006`
- Dirty files intentionally preserved:
  - `M .claude/settings.local.json`
  - `M apps/admin/next-env.d.ts`
  - `M apps/admin/tsconfig.tsbuildinfo`
  - `M apps/web/next-env.d.ts`
  - `M apps/web/tsconfig.tsbuildinfo`
  - `?? .tmp-gate1.mts`
  - `?? .tmp-wave2-qa-state.mts`
  - `?? docs/design/bjt-learner-redesign/.file-versions/`
  - `?? docs/design/bjt-learner-redesign/.od-frames/`

## Workspaces / applications

| Component | Path | Runtime | Production? | Notes |
|---|---|---|---|---|
| Learner web | `apps/web` | Next.js (App Router) | Yes | KEEP_NEXT_RUNTIME; no API route handlers except Keycloak BFF auth |
| Admin | `apps/admin` | Next.js (App Router) | Yes | Static export viability evaluated post-M6; Keycloak BFF auth routes |
| NestJS API | `apps/api` | NestJS (Node.js) | Yes | 100 controllers, 710 routes; PM2-managed on GCP VM |
| Go API | (not yet created) | — | No | Target for M1+ |
| Database package | `packages/database` | Prisma ORM | Yes | 174 models, shared across apps |
| Shared package | `packages/shared` | TypeScript/Zod | Yes | Shared contracts, Zod schemas |
| UI package | `packages/ui` | React components | Yes | Shared UI building blocks |

## Infrastructure

| Service | Config/source | Image/version | ARM64 verified | State/data path |
|---|---|---|---|---|
| PostgreSQL | `docker-compose.yml`, `deploy/gcp/compose.infrastructure.yml` | `postgres:17-alpine` | VERIFIED (multi-arch image) | Docker volume; prod bound to 127.0.0.1:15432 |
| Redis | `docker-compose.yml`, `deploy/gcp/compose.infrastructure.yml` | `redis:8-alpine` | VERIFIED (multi-arch image) | Docker volume; prod AOF enabled, 768mb maxmemory |
| Meilisearch | `docker-compose.yml`, `deploy/gcp/compose.infrastructure.yml` | `getmeili/meilisearch:v1.13` | VERIFIED (multi-arch image) | Docker volume; prod 1g mem_limit |
| MinIO | `docker-compose.yml`, `deploy/gcp/compose.infrastructure.yml` | `minio/minio:RELEASE.2025-04-22T22-12-26Z` | VERIFIED (multi-arch image) | Docker volume; prod bound to 127.0.0.1:9000/9001 |
| Keycloak | `docker/keycloak/docker-compose.yml`, `deploy/gcp/compose.infrastructure.yml` | `quay.io/keycloak/keycloak:26.2.4` | VERIFIED (multi-arch image) | Dedicated `keycloak-db` postgres:17-alpine |
| Caddy | `deploy/gcp/Caddyfile.template` | (system-installed) | ENVIRONMENT_BLOCKED (not locally running) | Reverse proxy; template uses `__BASE_DOMAIN__` placeholder |

## Auth dependencies

- Frontend auth library: `@keycloak/keycloak-js` (Next.js App Router BFF pattern)
- API auth middleware: `KeycloakAuthGuard` (custom guard using `jose` library, NOT Passport/JWT strategy)
- Admin auth middleware: `AdminRbacGuard` (Keycloak realm roles + DB permission sync)
- Keycloak realm/client: configured via `KEYCLOAK_ISSUER_URL`, `KEYCLOAK_CLIENT_ID`, per-app variants (`WEB_KEYCLOAK_*`, `ADMIN_KEYCLOAK_*`)
- User ID mapping: JIT provisioning via `KeycloakUserService.provisionLearner(claims)` → upsert by `keycloakSubject` or email → returns `appUserId`
- Roles: Realm roles + resource roles synced additively to `authz.admin_actor_role`; wildcard `"*"` grants all permissions
- Social providers: Google OAuth (feature-gated behind `"social_growth"`, DISABLED when Keycloak active)
- Email verification: Handled by Keycloak
- Password reset: Handled by Keycloak
- WebSocket auth: `PresenceGateway` verifies Bearer token via `client.handshake.auth.token`; `BattleGateway` has NO connection auth

## Jobs / async

| Job | Implementation | Trigger | Dependencies | Migration owner |
|---|---|---|---|---|
| ComebackExperienceCron | `@Cron("0 10 * * *")` Asia/Ho_Chi_Minh | Daily 10:00 AM | ComebackExperienceService | M10 |
| MagazineGenerationCron | `@Cron("30 5 * * *")` Asia/Ho_Chi_Minh | Daily 05:30 AM | MagazineGenerationService (4 kinds) | M10 |
| LotoAutopilotCron | `@Cron` x3 + `@Timeout(30s)` Asia/Tokyo | Mon/Thu/Fri 21:00-23:30 + daily 06:15 catchup + startup | LotoLabService; gated by `LOTO_AUTOPILOT_ENABLED` | M10 |
| PushNotificationCron | `@Cron("0 7 * * *")` Asia/Ho_Chi_Minh | Daily 07:00 AM | PushNotificationService | M10 |
| SmartNotificationCron | `@Cron` x4 Asia/Ho_Chi_Minh | 18:00 pet care, 20:00 streak early, 22:00 streak last, hourly stub | SmartNotificationService | M10 |
| BullMQ workers | **NONE FOUND** | — | — | No BullMQ infrastructure exists despite AGENTS.md reference |

## Test baseline

| Gate | Command | Result | Notes |
|---|---|---|---|
| Prisma validate | `pnpm prisma:validate` | PASS (exit 0) | Schema valid; Node version warning (24.12.0 vs 24.16.0 wanted) |
| Typecheck | pending | — | To be captured |
| Lint | pending | — | To be captured |
| Tests | pending | — | To be captured |
| Build | pending | — | To be captured |

## Media storage

- Current MinIO/S3 client: `minio` npm package via custom service (`apps/api/src/media/media.service.ts`)
- Buckets: `nihongo-bjt-media` (from `.env.example`)
- Key conventions: To be detailed from media agent results
- Public assets: Served via `media.__BASE_DOMAIN__` → MinIO:9000 through Caddy
- Private assets: Authenticated streaming through NestJS API
- Upload paths: Presigned PUT from client → MinIO direct; admin upload through API
- Download paths: Presigned GET or proxy through API
- DB metadata tables: `MediaAsset`, `CardMediaLink`, `ShareCardAsset`
- Planned BlobStore backend: `gocloud.dev/blob/fileblob`
- Planned local media root: `/srv/kotobawork/data/media`

## Frontend runtime audit

| App | Needs SSR/runtime? | Static blockers | Decision |
|---|---|---|---|
| Learner Web | Yes | Keycloak BFF routes, i18n server components, dynamic routes | KEEP_NEXT_RUNTIME |
| Admin | TBD post-M6 | Keycloak BFF routes, RBAC-dependent rendering | NEEDS_INVESTIGATION_POST_M6 |

## Next.js BFF Route Handlers

### Web (`apps/web/app/api/auth/keycloak/`)
- `authorize/route.ts` — Keycloak authorization redirect
- `callback/route.ts` — Keycloak OAuth callback
- `forgot-password/route.ts` — Password reset redirect
- `logout/route.ts` — Logout redirect
- `password-login/route.ts` — Direct password login
- `register/route.ts` — Registration redirect
- `session/route.ts` — Session validation
- `apps/web/app/api/auth/me/route.ts` — Current user endpoint
- `apps/web/app/auth/callback/route.ts` — Auth callback handler
- `apps/web/app/auth/logout/route.ts` — Logout handler

### Admin (`apps/admin/app/api/auth/keycloak/`)
- `authorize/route.ts` — Keycloak authorization redirect
- `callback/route.ts` — Keycloak OAuth callback
- `logout/route.ts` — Logout redirect
- `password-login/route.ts` — Direct password login
- `session/route.ts` — Session validation
- `apps/admin/app/auth/callback/route.ts` — Auth callback handler
- `apps/admin/app/auth/logout/route.ts` — Logout handler

**Total BFF routes: 17** (10 web + 7 admin), all Keycloak auth-related.

## Deployment Topology

- **Production**: GCP VM with PM2 process manager (NOT containerized app deployment)
- **Infrastructure**: Docker Compose for Postgres, Redis, Meilisearch, MinIO, Keycloak
- **Reverse proxy**: Caddy with template-based domain substitution
- **CI/CD**: GitHub Actions → SSH-based rsync deploy → PM2 reload
- **Secondary target**: OCI (`deploy/oci/`) with custom MinIO Dockerfile and volume overrides
- **No Kubernetes, no Terraform**

## Environment Variables (Complete Classification)

See `docs/migrations/go-backend-v2/reports/M0_ENV_VARIABLES.md` for full inventory.

Key categories: Database, Redis, Meilisearch, MinIO/S3, Keycloak (server + client-side), Google OAuth, Stripe, Image Generation, TTS/Voice, Web Push (VAPID), Ads/Monetization, Networking/App, Feature Flags.