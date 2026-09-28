# P0_PLAN_REVALIDATION_REPORT

## Git

- **cwd:** `/Users/thanhnguyen/Documents/Projects/nihongo-bjt`
- **branch:** `main`
- **starting HEAD:** `b615f4fb0ceb786ad1b86f7f0d5f21c6c466a5f7`
- **working tree state:**
  - Modified: `.claude/settings.local.json`, `apps/admin/next-env.d.ts`, `apps/admin/tsconfig.tsbuildinfo`, `apps/web/next-env.d.ts`, `apps/web/tsconfig.tsbuildinfo`
  - Untracked: `.tmp-gate1.mts`, `.tmp-wave2-qa-state.mts`, `docs/design/bjt-learner-redesign/.file-versions/`, `docs/design/bjt-learner-redesign/.od-frames/`, `docs/migrations/`
- **Note:** All modified/untracked files are unrelated to migration. No migration code has been written.

---

## Current Architecture

### Runtime Topology (from repository truth)

```text
Internet → Caddy (reverse proxy + TLS)
  ├── app.__DOMAIN__   → Next.js Learner Web (:3000, force-dynamic SSR)
  ├── admin.__DOMAIN__ → Next.js Admin     (:3001, force-dynamic SSR)
  ├── api.__DOMAIN__   → NestJS API        (:4000, Express + Socket.IO)
  ├── auth.__DOMAIN__  → Keycloak          (:8080, IP-restricted admin)
  └── media.__DOMAIN__ → MinIO             (:9000, presigned URLs)
```

### Infrastructure Services

| Service | Image | Role | RAM Limit (GCP prod) |
|---------|-------|------|---------------------|
| PostgreSQL | postgres:17-alpine | Primary data store, 20+ schemas | 1 GB |
| Keycloak DB | postgres:17-alpine | Dedicated Keycloak store | 512 MB |
| Keycloak | quay.io/keycloak/keycloak:26.2.4 | OIDC/OAuth2 identity provider | 1536 MB |
| Redis | redis:8-alpine | Cache/rate-limit/pub-sub | 896 MB (768 MB maxmemory) |
| Meilisearch | getmeili/meilisearch:v1.13 | Japanese/typo-tolerant search | 1 GB (2 GiB indexing) |
| MinIO | minio/minio:RELEASE.2025-04-22T22-12-26Z | Object storage (media/uploads) | 768 MB |
| Caddy | (template-based) | TLS termination, reverse proxy | N/A |

### NestJS API Modules (100 controllers)

Active modules discovered in `apps/api/src/`:
auth, keycloak, battle, presence, recommendation, nhk-news, daily-radar, career-rpg, public-profile, privacy, flashcards, security, gamification, learning, health, admin, quiz, content, autofill, assessment, openapi, daily, operations, growth, search, reading-assist, magazine, learner, bookmarks, cardgen, exercise, http, levels, legal, announcement, monetization (ads/billing), notifications, analytics, companion, media

### Background Jobs / Cron

- `ComebackExperienceCron` — daily 10:00 ICT
- `MagazineGenerationCron` — daily 05:30 ICT
- `LotoAutopilotCron` — magazine loto
- `PushNotificationCron` — push notifications
- `SmartNotificationCron` — smart notifications
- BullMQ queues in: recommendation, revenge-mode, operations, analytics

### Realtime (Socket.IO)

- `BattleGateway` — lobby, challenge, answer, PvP, bot (12+ events)
- `PresenceGateway` — heartbeat, query

### Frontend Auth Architecture

- Both apps use `@nihongo-bjt/keycloak-oidc` shared package
- Per-app cookie prefixes: `bjt_web_*` and `bjt_admin_*`
- HttpOnly cookies for access_token, id_token, refresh_token, pkce_verifier, state, return_to
- Next.js route handlers for: authorize, callback, password-login, logout, session, register (web only), forgot-password (web only)
- Server-side `cookies()` reads in `[locale]/layout.tsx` with `force-dynamic`
- `AdminKeycloakSessionGate` / `KeycloakAuthShell` server components gate rendering
- No standalone `middleware.ts` file found; locale routing via `[locale]` dynamic segment + `generateStaticParams`

### Identity Schema

- `UserProfile.keycloakSubject` — nullable unique Keycloak sub mapping
- `AdminActor.keycloakSubject` — nullable unique Keycloak sub mapping
- `UserInvitation.keycloakUserId` — nullable varchar(80)
- `AuthLinkCode` — code_hash-based link codes (auth schema)
- `UserSocialConnection` — social/friend connections (gamification schema)
- RBAC: `AdminRole`, `AdminPermission`, `AdminActorRole`, `AdminRolePermission` (authz schema)
- Audit: `AdminAuditLog` (ops schema), `AdminAuditEvent` (admin schema)

### Storage Usage

- MinIO client used directly in `MediaService` (presigned PUT/GET, statObject, putObject, getObject)
- Object keys: `{userId}/{uuid}-{safeFileName}`, `admin/{actorId}/{uuid}-{safeFileName}`
- Sharp image processing for proxy downloads and share images
- DB stores `objectKey`, `mimeType`, `byteSize`, `provider`, `rightsStatus`, `license`, `provenance`, `accessibility`
- Public read via presigned GET URLs signed against public endpoint
- Private read gated by ownership or `cardMediaLink` association

### Deployment

- GCP production: `deploy/gcp/compose.infrastructure.yml` (full infra stack)
- OCI target: `deploy/oci/compose.data.yml` (volume overrides only, references base compose)
- OCI Caddy template: `deploy/oci/Caddyfile.template` (5 subdomains)
- ARM64 MinIO: custom Dockerfile building from source at pinned commit `7aac2a2`
- No Dockerfiles found for NestJS, Next.js web, or Next.js admin in repository

---

## Plan Validation Matrix

| Area | Existing Plan Assumption | Result | Evidence | Required Change |
|------|------------------------|--------|----------|-----------------|
| Go backend | chi/net-http, pgx, sqlc, slog, go-redis, gocloud.dev/blob | CONFIRMED | NestJS has 100 controllers across 30+ modules; Go replacement is feasible for this scale | None |
| Keycloak removal | Replace with first-party Go auth | MODIFY | Keycloak deeply integrated: 3 OIDC clients (web/admin/mobile), PKCE, refresh tokens, realm roles, dedicated DB, admin IP restriction on Caddy, `keycloak-oidc` shared package, `AdminKeycloakSessionGate` server component, `force-dynamic` layouts reading cookies server-side | Add explicit mobile client migration plan; add server-component auth gate replacement design; document cookie prefix migration strategy |
| Auth/session design | Opaque sessions, Argon2id, HttpOnly cookies | CONFIRMED | Plan correctly identifies cookie-based session model; current system already uses HttpOnly cookies via Next.js BFF pattern | None for design; implementation must handle dual-cookie-prefix transition |
| Password migration | Three options listed (re-auth, hash export, forced reset) | UNKNOWN | Cannot determine feasibility without inspecting Keycloak credential store format; realm-export.json shows plaintext test credentials only | Must investigate Keycloak credential export before selecting approach; add as M2 prerequisite investigation task |
| PostgreSQL | Remains authoritative, multi-schema | CONFIRMED | 20+ schemas (admin, analytics, assessment, auth, authz, battle, billing, career, content, curriculum, daily, exercise, gamification, growth, iam, learning, legal, l10n, media, monetization, ops, profile); Prisma ORM | None |
| Redis | Ephemeral/cache/rate-limit/realtime | CONFIRMED | Used for BullMQ queues, caching, rate limiting; 768 MB maxmemory configured; AOF persistence enabled | None |
| Meilisearch | Keep if justified | CONFIRMED | v1.13 deployed; 2 GiB indexing memory; Japanese search with typo tolerance is core product feature | None; keep as-is |
| MinIO removal | Replace with gocloud.dev/blob/fileblob | MODIFY | MediaService uses presigned PUT/GET URLs extensively for browser-direct uploads; `gocloud.dev/blob/fileblob` does NOT support presigned URLs natively | Must redesign upload flow: either (A) server-proxied uploads through Go API, or (B) implement signed URL equivalent via Caddy/temp tokens; this is a HIGH-risk architectural change not addressed in plan |
| gocloud.dev/blob | Abstraction over fileblob → s3blob | MODIFY | fileblob lacks presigned URL support; current app relies on presigned PUT for browser-direct upload and presigned GET for time-limited private access | Either accept server-proxied I/O (simpler, more Go load) or plan custom signed-URL mechanism; update BlobStore interface to reflect chosen approach |
| LocalFS | /srv/kotobawork/media on Oracle data volume | CONFIRMED | OCI compose.data.yml mounts `/srv/kotobawork/data/*`; plan's media path aligns | Minor: actual mount is `/srv/kotobawork/data/` not `/srv/kotobawork/`; adjust paths |
| Caddy media serving | Browser → Caddy → local media for public files | MODIFY | Current Caddy config proxies `media.__DOMAIN__` to MinIO (:9000); no static file serving configured; private media uses presigned URLs | Must add Caddy `file_server` directive for public media root; must design auth-gated path for private media (cannot use presigned URLs with fileblob); update Caddyfile template |
| Web runtime | "SSR only if truly needed" | KEEP_NEXT_RUNTIME | `force-dynamic` in layout; server-side cookie reads via `cookies()`; `KeycloakAuthShell` server component gates rendering; socket.io-client used in battle/flashcards/quiz/scenarios; i18n messages loaded server-side | Web MUST keep Next.js runtime; static export is NOT viable without major auth/i18n redesign |
| Admin runtime | "Static export if viable" | NEEDS_INVESTIGATION | `force-dynamic` in layout; `AdminKeycloakSessionGate` server component; `isAccessTokenUsable` server-side check; but admin is SPA-like with client shell (`AdminShellClient`) | Admin MAY be static-exportable after auth cutover to Go cookie sessions; requires removing server-side Keycloak gate and replacing with client-side or Caddy-level auth check; classify as post-M6 evaluation |
| ARM64 | Mandatory for Oracle A1 | CONFIRMED | Custom ARM64 MinIO Dockerfile exists; all base images (postgres:17-alpine, redis:8-alpine, meilisearch:v1.13, keycloak:26.2.4) have ARM64 variants | None; verify Go cross-compilation in CI |
| Docker/deployment | Single-host Docker Compose | CONFIRMED | GCP uses compose.infrastructure.yml; OCI uses compose.data.yml overlay; Caddy templates exist | None |
| Background jobs | Not detailed in plan | ADD | 5 cron jobs + BullMQ queues in recommendation, revenge-mode, operations, analytics; these run INSIDE NestJS process | Must plan explicit migration of cron jobs and BullMQ workers to Go; add to execution waves between M10-M11 |
| Realtime | Not detailed in plan | ADD | BattleGateway (12+ Socket.IO events) + PresenceGateway (heartbeat/query); socket.io-client in 7+ frontend components | Must plan Socket.IO → WebSocket migration or Go Socket.IO library adoption; add to execution waves; HIGH complexity |
| API compatibility | Strangler migration by domain | CONFIRMED | 100 controllers across 30+ modules; plan's domain-by-domain approach is correct | None |
| Oracle resource budget | ~7-10 GB steady state post-migration | CONFIRMED | Current GCP limits total ~5.7 GB for infra alone; removing Keycloak (1.5 GB + 512 MB DB) + MinIO (768 MB) + NestJS (~0.5-1 GB) saves ~3-3.8 GB; Go API + reduced Next fits comfortably | None |

---

## Missing From Plan

1. **Mobile client (`nihongo-mobile`)**: Keycloak realm has a third OIDC client for Flutter mobile app with PKCE and custom redirect URI (`com.nihongobjt.app://oauth2redirect`). Plan mentions only web and admin. Mobile auth migration must be explicitly scoped.

2. **Background job migration**: 5 NestJS cron jobs and BullMQ queue processors are not addressed. These run inside the NestJS process and will be lost when NestJS is retired. Must be migrated to Go scheduler/workers.

3. **Socket.IO realtime migration**: Battle and Presence gateways use Socket.IO with 14+ event types. Frontend uses `socket.io-client` in 7+ components. Plan mentions "realtime" only in passing. Requires explicit protocol decision (native WebSocket, Go Socket.IO library, or SSE).

4. **Sharp image processing**: `MediaService` and `share-image.renderer.ts` use Sharp for image resizing/proxying. Go equivalent (e.g., `imaging`, `bimg`) must be planned or Sharp retained as sidecar.

5. **Next.js route handlers as BFF**: Both apps have 10+ Next.js API route handlers that proxy/authenticate against NestJS. These are part of the auth boundary and must be migrated alongside or before Keycloak removal.

6. **Dockerfiles for application services**: No Dockerfiles exist for NestJS API, Next.js web, or Next.js admin in the repository. Only infrastructure images are defined. Application containerization strategy is undocumented.

7. **Stripe/billing webhooks**: `stripe-webhook.controller.ts` and `billing-webhook.controller.ts` exist. Payment webhook handling must be migrated with exact signature verification semantics preserved.

8. **Google OAuth**: `google-oauth.service.ts` and `google-oauth.controller.ts` exist with feature-gate tests. Social login migration is not addressed in plan.

9. **i18n/locale routing mechanism**: Both apps use `[locale]` dynamic segments with `generateStaticParams` and server-side message loading. No standalone middleware.ts exists. Locale resolution is embedded in layouts. This affects static export viability.

10. **Keycloak admin IP restriction**: Caddy template restricts `auth.__DOMAIN__/admin*` to `__ADMIN_IP__`. This security control must be preserved or replaced in the new architecture.

---

## Incorrect Assumptions

1. **"Admin can likely become static"** — Partially incorrect. Admin currently uses `force-dynamic` rendering with server-side Keycloak session gating. Static export is only viable AFTER auth cutover replaces server-side Keycloak checks with client-side or Caddy-level auth. Premature static export would break admin authentication.

2. **"Learner Web might be static"** — Incorrect. Web uses `force-dynamic`, server-side cookie reads, Socket.IO client integration, and server-rendered auth shells. Static export is NOT viable without fundamental auth and i18n redesign.

3. **"gocloud.dev/blob/fileblob supports presigned URLs"** — Incorrect. fileblob does not support `SignedURL`. Current app relies heavily on presigned PUT (browser-direct upload) and presigned GET (time-limited private access). The BlobStore abstraction must either drop presigned URL support (requiring server-proxied I/O) or implement a custom equivalent.

4. **"MinIO can be transparently replaced"** — Underestimated. MinIO is accessed via presigned URLs that bypass the application server entirely. Replacing with fileblob changes the upload/download architecture fundamentally, not just the storage backend.

5. **"No middleware.ts means simple locale routing"** — Misleading. Locale routing is handled via `[locale]` dynamic segments with `generateStaticParams` and server-side layout logic. The absence of middleware.ts does not mean locale routing is trivially extractable.

---

## Security Risks

| Risk | Severity | Detail |
|------|----------|--------|
| Presigned URL replacement | HIGH | Current browser-direct uploads bypass app server. Server-proxied uploads increase Go attack surface (body parsing, streaming, memory). Must implement proper size limits, content-type validation, and streaming to avoid buffering entire uploads in memory. |
| Cookie prefix migration | HIGH | Current `bjt_web_*` / `bjt_admin_*` prefixes prevent cross-app session collision. New Go sessions must maintain equivalent isolation during transition. Dual-cookie period creates fixation risk. |
| Admin authorization bypass | HIGH | Current admin auth chains: Keycloak JWT → NestJS guard → `AdminActor.keycloakSubject` lookup → RBAC permission check. Go replacement must replicate ALL layers. Missing any layer exposes admin APIs. |
| Mobile client orphaning | MEDIUM | Flutter mobile app uses `nihongo-mobile` Keycloak client. If Keycloak is retired before mobile auth migration, mobile users lose access. |
| Private media exposure | MEDIUM | Current private media uses presigned GET with expiry. fileblob has no equivalent. Naive Caddy file_server would expose all media publicly. Must implement auth-gated delivery path. |
| Password hash migration | MEDIUM | Keycloak credential format unknown. Incorrect dual-verifier implementation could lock out users or accept wrong passwords. Must validate against real Keycloak credential store before implementation. |
| Socket.IO auth gap | MEDIUM | Current Socket.IO gateways presumably validate Keycloak tokens. Go WebSocket replacement must implement equivalent auth before accepting connections. |
| Billing webhook integrity | LOW | Stripe/billing webhook signature verification must be preserved exactly. Incorrect migration could accept forged payment events. |

---

## Migration Risks

| Risk | Level | Rationale |
|------|-------|-----------|
| Presigned URL → server-proxied upload redesign | BLOCKER | Fundamental architecture change affecting upload UX, bandwidth, Go memory, and security surface. Must be resolved before M7. |
| Mobile client auth migration | HIGH | Third OIDC client not in plan. Retirement of Keycloak without mobile migration breaks production mobile app. |
| Socket.IO → WebSocket migration | HIGH | 14+ event types across 2 gateways; 7+ frontend consumer components. Protocol change requires coordinated frontend/backend release. |
| Background job extraction from NestJS | HIGH | 5 crons + BullMQ workers embedded in NestJS. Loss of these on NestJS retirement breaks magazine generation, notifications, recommendations, comeback experiences. |
| Admin static export timing | MEDIUM | Cannot evaluate until after Go auth cutover. Premature attempt wastes effort. Correct sequencing: M6 (admin auth cutover) → then evaluate static export. |
| Password credential migration | MEDIUM | Approach cannot be selected without Keycloak credential store inspection. May require user re-authentication flow or forced reset. |
| Google OAuth migration | MEDIUM | Social login exists but is feature-gated. Must decide: migrate to Go OAuth or retire. Silent loss breaks affected users. |
| Sharp image processing replacement | LOW | Can retain Sharp as Node.js sidecar or replace with Go imaging library. Non-blocking. |
| Caddy media path configuration | LOW | Straightforward once upload/download architecture is decided. |

---

## Proposed Plan Amendments

### Amendment 1: Add Mobile Client Migration Scope
- Add `nihongo-mobile` Flutter client to auth migration scope
- Document PKCE flow requirements for public client
- Add mobile auth cutover as prerequisite for Keycloak retirement (M12 gate)

### Amendment 2: Redesign Upload/Download Architecture
- Replace assumption of transparent fileblob swap with explicit architecture decision:
  - Option A: Server-proxied uploads through Go API (simpler, higher Go load)
  - Option B: Custom signed-URL mechanism with Caddy token validation (complex, preserves direct upload)
- Decision required before M7 implementation
- Update BlobStore interface to reflect chosen approach (remove or replace `SignedURL`)

### Amendment 3: Add Background Job Migration Wave
- Insert new wave between M10 and M11: "M10.5 — Background Job Migration"
- Scope: 5 cron jobs + BullMQ queue processors
- Require Go scheduler (e.g., `robfig/cron`) + worker pool
- Preserve timezone-aware scheduling (Asia/Ho_Chi_Minh)

### Amendment 4: Add Realtime Migration Wave
- Insert new wave: "M11.5 — Realtime Protocol Migration"
- Decide: native WebSocket vs Go Socket.IO library vs SSE
- Migrate BattleGateway (12+ events) and PresenceGateway
- Coordinate frontend socket.io-client replacement
- Auth validation on connection establishment

### Amendment 5: Correct Frontend Runtime Classifications
- Web: classify as `KEEP_NEXT_RUNTIME` (not conditional)
- Admin: classify as `NEEDS_INVESTIGATION_POST_M6` (evaluate only after Go auth cutover)
- Remove "static export if viable" language for Web

### Amendment 6: Add Password Migration Investigation Task
- Add to M2: "Investigate Keycloak credential store format and export feasibility"
- Decision gate: select migration approach (re-auth / hash export / forced reset) BEFORE implementing credential verifier
- Do not proceed with dual-verifier without validated credential format

### Amendment 7: Add Google OAuth Decision
- Determine if Google OAuth is active in production
- If active: add to M4 (account lifecycle) scope
- If inactive/feature-gated: document explicit retirement decision

### Amendment 8: Add Application Dockerfile Strategy
- Document or create Dockerfiles for NestJS API, Next.js web, Next.js admin
- Required for ARM64 build verification and Oracle deployment
- Add to M1 (Go bootstrap) as parallel documentation task

### Amendment 9: Update Caddy Configuration Plan
- Add `file_server` directive for public media root
- Add auth-gated delivery path for private media
- Preserve admin IP restriction on auth endpoints
- Update Caddyfile template as part of M7

### Amendment 10: Adjust Storage Paths
- Change `/srv/kotobawork/media` to `/srv/kotobawork/data/media` to match actual OCI volume mounts
- Update all path references in plan documents

---

## H0 Documentation Hygiene Proposal

### Classification

| Path | Status | Notes |
|------|--------|-------|
| `AGENTS.md` | CANONICAL | Active operating guide |
| `README.md` | CANONICAL | Setup and dev guide |
| `AI_CONTEXT.md` | CANONICAL | AI assistant brief |
| `docs/spec/*` | CANONICAL | Product specifications |
| `docs/migrations/go-backend-v2/*` | ACTIVE | Current migration workspace |
| `docs/design/bjt-learner-redesign/*` | ACTIVE | Parallel design work |
| `docs/deployment/*` | ACTIVE | Deployment guides |
| `docs/ops/*` | ACTIVE | Operational docs |
| `docs/product/*` | ACTIVE | Product docs |
| `deploy/gcp/*` | HISTORICAL | GCP-specific (may be superseded by OCI) |
| `deploy/oci/*` | ACTIVE | Target deployment |
| `docker/keycloak/*` | ACTIVE (transitional) | Retired after M12 |
| `archive/phase-00-data-import/*` | HISTORICAL | Completed phase |
| `.cursor/rules/*.mdc` | ACTIVE | Cursor IDE rules |
| `.github/instructions/*` | ACTIVE | GitHub Copilot instructions |
| `docs/cursor-prompts/*.xml` | ACTIVE | Cursor prompt templates |

### Proposed Cleanup (after ChatGPT review)

- No files should be deleted during P0
- After P0 approval, consider archiving `deploy/gcp/*` if OCI fully supersedes
- `archive/phase-00-data-import/` is already archived; no action needed
- Generated files (`.next/`, `.turbo/`, `tsconfig.tsbuildinfo`) are gitignored or untracked; no action needed

---

## Recommended Execution Order

The existing M0–M15 ordering is **structurally sound** but requires insertions and dependency adjustments:

```text
M0  — Truth capture                    (UNCHANGED)
M1  — Go bootstrap                     (ADD: app Dockerfiles, mobile client inventory)
M2  — Auth persistence                 (ADD: Keycloak credential investigation)
M3  — Auth core                        (UNCHANGED)
M4  — Account lifecycle                (ADD: Google OAuth decision/migration)
M5  — Learner auth cutover             (UNCHANGED)
M6  — Admin auth cutover               (UNCHANGED)
M6.5 — Admin static export evaluation  (NEW: only after M6 proves Go auth works)
M7  — Storage abstraction & media      (MODIFY: requires upload architecture decision first)
M8  — Frontend runtime reduction       (MODIFY: Web is KEEP_NEXT_RUNTIME; Admin evaluated at M6.5)
M9  — Business read APIs               (UNCHANGED)
M10 — Business write APIs              (UNCHANGED)
M10.5 — Background job migration       (NEW: crons + BullMQ workers)
M11 — Search/media/realtime closure    (MODIFY: split into M11 + M11.5)
M11.5 — Realtime protocol migration    (NEW: Socket.IO → WebSocket/alternative)
M12 — Keycloak disable                 (ADD: mobile client cutover as prerequisite)
M13 — MinIO disable                    (UNCHANGED)
M14 — NestJS disable                   (ADD: verify all crons/workers/realtime migrated)
M15 — Oracle resource optimization     (UNCHANGED)
```

Key dependency changes:
- M7 now depends on upload architecture decision (pre-M7)
- M6.5 (Admin static eval) depends on M6 completion
- M10.5 and M11.5 are new mandatory waves
- M12 gate now includes mobile client verification

---

## Gate Result

**P0_PASS_WITH_PLAN_CHANGES**

### Required Amendments Before M0 Implementation

1. Resolve upload/download architecture decision (server-proxied vs custom signed URLs) — BLOCKER for M7
2. Add mobile client (`nihongo-mobile`) to auth migration scope
3. Add background job migration wave (M10.5)
4. Add realtime protocol migration wave (M11.5)
5. Correct Web runtime classification to KEEP_NEXT_RUNTIME
6. Reclassify Admin static export as post-M6 evaluation
7. Add Keycloak credential investigation as M2 prerequisite
8. Add Google OAuth decision to M4 scope
9. Add application Dockerfile strategy to M1
10. Update storage paths to match actual OCI volume mounts (`/srv/kotobawork/data/media`)
11. Update Caddy configuration plan for file_server + auth-gated private media
12. Add mobile client cutover as M12 gate prerequisite

---

## Git End State

- **final HEAD:** `b615f4fb0ceb786ad1b86f7f0d5f21c6c466a5f7` (unchanged)
- **files created:** `docs/migrations/go-backend-v2/reports/P0_PLAN_REVALIDATION_REPORT.md`
- **files modified:** none
- **git status:** clean except pre-existing unrelated changes
- **commits:** none (report artifact only, no implementation)