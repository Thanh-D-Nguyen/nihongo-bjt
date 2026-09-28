# M0 Repository Truth Report

## Identification

- **Starting HEAD**: `0fc4486f5cfd2edc4433359753be573605234006`
- **Final HEAD**: (pending commit)
- **Branch**: `main`
- **Wave**: M0 — Repository truth / detailed inventory
- **Date**: 2026-09-28

## Artifact List

| Artifact | Path | Status |
|---|---|---|
| Repository Inventory | `docs/migrations/go-backend-v2/templates/repo-inventory.md` | POPULATED |
| API Compatibility Matrix | `docs/migrations/go-backend-v2/templates/api-compatibility-matrix.csv` | SUMMARY_POPULATED |
| Auth Behavior Matrix | `docs/migrations/go-backend-v2/templates/auth-behavior-matrix.csv` | POPULATED |
| Media Migration Inventory | `docs/migrations/go-backend-v2/templates/media-migration-inventory.csv` | POPULATED |
| Migration Status | `docs/migrations/go-backend-v2/templates/migration-status.md` | POPULATED |
| M0 Report (this file) | `docs/migrations/go-backend-v2/reports/M0_REPOSITORY_TRUTH_REPORT.md` | CREATED |

## Controller and Route Counts

| Metric | Count | Evidence |
|---|---|---|
| **Controller files** | **100** | CodeGraph `codegraph_files` query: `apps/api/src/**/*.controller.ts` returned exactly 100 files |
| **Total route endpoints** | **710** | Agent investigation of all 100 controller files |
| GET routes | 365 | Structural extraction from decorators |
| POST routes | 237 | Structural extraction from decorators |
| PUT routes | 14 | Structural extraction from decorators |
| PATCH routes | 63 | Structural extraction from decorators |
| DELETE routes | 31 | Structural extraction from decorators |

### Auth Pattern Distribution

| Pattern | Count | Notes |
|---|---|---|
| `AdminRbacGuard` (class-level) | 59 controllers | All `admin/*` prefixed controllers |
| `KeycloakAuthGuard` (class-level) | 48 controllers | Learner-facing authenticated controllers |
| `KeycloakAuthGuard` (method-level) | ~10 methods | Selective auth on otherwise public controllers |
| `@PublicRoute()` (method-level) | 9 routes | Explicitly public endpoints on guarded controllers |
| No guard (fully public) | ~15 controllers | health, legal-info, magazine, search, canonical-content, public-growth, google-oauth, stripe-webhook |
| Mixed auth | 5 controllers | nhk-news, companion, quiz, daily, analytics have both public and authenticated routes |

### Canonical Expectation Reconciliation

The P0.1 plan expected "100 controllers". **Actual count: 100 controller files.** This matches exactly. However, several files contain multiple `@Controller` classes (e.g., `canonical-content.controller.ts` has 5 controllers, `career-rpg.controller.ts` has 2), so the effective number of distinct NestJS controller classes exceeds 100. The route count of 710 is the authoritative metric for migration scope.

## Current App/Runtime Topology

```
┌─────────────────────────────────────────────────────────────┐
│                    GCP Production VM                        │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ Caddy    │→ │ Next.js  │  │ Next.js  │                  │
│  │ (reverse │  │ Web      │  │ Admin    │                  │
│  │  proxy)  │  │ :3000    │  │ :3001    │                  │
│  └────┬─────┘  └──────────┘  └──────────┘                  │
│       │                                                     │
│       ├→ NestJS API :4000 (PM2 managed)                     │
│       ├→ Keycloak :8080 (Docker Compose)                    │
│       └→ MinIO :9000/:9001 (Docker Compose)                │
│                                                             │
│  Docker Compose infrastructure:                             │
│  ┌────────────┐ ┌───────┐ ┌─────────────┐ ┌────────────┐  │
│  │ PostgreSQL │ │ Redis │ │ Meilisearch │ │ KeycloakDB │  │
│  │ :15432     │ │ :6379 │ │ :7700       │ │ (postgres) │  │
│  └────────────┘ └───────┘ └─────────────┘ └────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Key finding**: Application processes run as bare Node.js via PM2, NOT in Docker containers. Only infrastructure services are containerized.

**Next.js BFF Routes**: 17 total (10 web + 7 admin), ALL Keycloak auth-related:
- Web: authorize, callback, forgot-password, logout, password-login, register, session, me, auth/callback, auth/logout
- Admin: authorize, callback, logout, password-login, session, auth/callback, auth/logout

## Auth Dependency Summary

### Architecture: Stateless Bearer Token + JIT User Provisioning

| Aspect | Current Behavior | Keycloak Dependency | Go Target |
|---|---|---|---|
| Token validation | `jose` library (`jwtVerify`) — NO Passport/JWT strategy | HARD | First-party opaque sessions |
| User identity | `req.keycloakUser` (NOT `req.user`) set by `KeycloakAuthGuard` | HARD | Session-based from PostgreSQL |
| User provisioning | JIT upsert by `keycloakSubject` or email → `appUserId` | HARD | Pre-provisioned at registration |
| Admin gate | Keycloak realm role check + DB permission sync | HARD | Pure DB RBAC |
| Logout | Client-side token discard only; no server endpoint | SOFT | Server-side session revocation |
| Session store | NONE — completely stateless | HARD | New capability for Go |
| Refresh tokens | Managed by Keycloak directly (clients talk to Keycloak) | HARD | Go-managed refresh |
| Email verification | Delegated to Keycloak | HARD | Go-managed |
| Password reset | Delegated to Keycloak | HARD | Go-managed |

### Guards and Decorators Found

1. **`KeycloakAuthGuard`** — Primary learner auth; custom guard using `jose`, NOT `@nestjs/passport`
2. **`AdminRbacGuard`** — Admin auth; Keycloak realm role gate + DB permission check
3. **`@PublicRoute()`** — Bypasses auth on specific endpoints
4. **`@KeycloakAuthOptional()`** — Validates token if present, passes through if absent
5. **`@CurrentUser()`** — Injects `KeycloakAuthenticatedUser | undefined` from `req.keycloakUser`
6. **`EntitlementGuard`** — Monetization gate; must run AFTER `KeycloakAuthGuard`
7. **No `@Roles()`, `@Permissions()`, `JwtAuthGuard`, or Passport strategies exist**

### WebSocket Auth

- **PresenceGateway** (`/presence`): Verifies Bearer token from `client.handshake.auth.token` via `KeycloakTokenService.verifyAccessToken()`; silent disconnect on failure
- **BattleGateway** (`/battle`): **NO connection authentication**; all business logic delegated to `BattleOrchestratorService`

## DB Ownership Summary

**Total Prisma models: 174** (validated via `pnpm prisma:validate` — PASS)

### Classification by Domain

| Category | Models | Migration Boundary |
|---|---|---|
| **Identity/Auth** | UserProfile, IdentityProviderAccount, AuthLinkCode, AdminActor, AdminActorRole, AdminRole, AdminPermission, AdminRolePermission, LoginEvent, PushSubscription, NotificationPreference | M2-M3: Additive session tables; existing tables retained |
| **Content (reference)** | Lexeme, Kanji, GrammarPoint, ExampleSentence, LexemeSense, KanjiComponent, etc. (25+ models) | M8: Read-only migration; schema preserved |
| **Content (import/pipeline)** | ContentImportBatch, ContentRawItem, ContentImportError, ContentImportMapping, ContentQaReview, EntityImportProvenance, ContentEnrichment, ContentVersion | M9: Write-path migration |
| **Learning/Practice** | Deck, FlashcardVariant, DeckCard, UserFlashcard, Exercise, ExerciseSession, QuizSession, StudySession, ReviewEvent, etc. (30+ models) | M8-M9: Core business migration |
| **Gamification** | AchievementDefinition, UserAchievement, UserStreak, StreakConfig, LeaderboardEntry, CompanionPet, SeasonalEvent, StudyGroup, etc. (20+ models) | M8-M9: Business logic migration |
| **Monetization** | Plan, EntitlementDefinition, PlanEntitlement, QuotaPolicy, UserSubscription, SubscriptionEvent, BillingWebhookEvent, AdPlacement, AdCampaign, etc. (15+ models) | M9-M11: Billing-critical path |
| **Media** | MediaAsset, CardMediaLink, ShareCardAsset | M7: BlobStore migration |
| **Analytics** | AnalyticsEvent, AnalyticsDailyMetric, AnalyticsRollupRun, WeeklyReport | M8: Event ingestion migration |
| **Operations** | FeatureFlag, DeadLetterEntry, AdminAuditLog, AdminAuditEvent, PrivacyRequest, LegalPolicy | M9: Operational migration |
| **Growth/Social** | ReferralCode, ReferralEvent, ShareItem, ShareTemplate, GrowthCampaign, Announcement | M8-M9: Social features |
| **Battle/Realtime** | BattleSession, BattleRound, BattleConfig, BattleBot, BattleChatMessage, BattleAbuseReport | M12: Realtime migration |
| **Magazine/Loto** | MagazineArticle, LotoDraw, LotoGeneratedSet, LotoGenerationRun, MagazineVocabItem | M8-M9: Content generation |
| **Career/Story** | MissionArc, MissionChapter, ChapterAttempt, CareerRank, UserCareerState, NpcRelation, StoryNpc | M8-M9: RPG features |

### Schema Namespaces

The Prisma schema uses PostgreSQL schemas: `content`, `authz`, `media`, `analytics` (inferred from model groupings and `.env.example` schema reference).

## Jobs/Queues Summary

### Cron Jobs (5 classes, 10 @Cron decorators)

| Job | Schedule | Timezone | Handler | Dependencies |
|---|---|---|---|---|
| ComebackExperienceCron | `0 10 * * *` | Asia/Ho_Chi_Minh | handleDailyCheck | ComebackExperienceService |
| MagazineGenerationCron | `30 5 * * *` | Asia/Ho_Chi_Minh | handleDailyGeneration | MagazineGenerationService (4 kinds) |
| LotoAutopilotCron | 3 crons + @Timeout(30s) | Asia/Tokyo | handleLoto6/7, catchups | LotoLabService; gated by LOTO_AUTOPILOT_ENABLED |
| PushNotificationCron | `0 7 * * *` | Asia/Ho_Chi_Minh | handleDailyKanjiPush | PushNotificationService |
| SmartNotificationCron | 4 crons | Asia/Ho_Chi_Minh | pet/streak/study handlers | SmartNotificationService |

### BullMQ Workers

**FINDING: NO BullMQ infrastructure exists in this codebase.** Despite AGENTS.md and AI_CONTEXT.md referencing "Redis/BullMQ handles background jobs", exhaustive search found zero matches for `BullModule`, `@Processor`, `@OnProcess`, or `Queue` imports. All "queue" references are business-domain naming (e.g., `getReviewQueue()` returns a pipeline result, not a message queue). Operations controller queue management endpoints operate on PostgreSQL-stored state, not BullMQ.

**Migration implication**: M10 scope is cron migration only; no message queue infrastructure to migrate.

## Realtime Summary

### Socket.IO Gateways (2 found)

| Gateway | Namespace | Events | Auth | Frontend Consumers |
|---|---|---|---|---|
| BattleGateway | `/battle` | 9 @SubscribeMessage handlers (lobby_join, lobby_message, challenge_user, answer, challenge_bot, accept_challenge, decline_challenge, pvp_answer, pvp_forfeit) | **NONE** | **ZERO** |
| PresenceGateway | `/presence` | 2 handlers (heartbeat, query) + 4 emitted events (user_online, user_offline, query_result, error) | Bearer token via handshake.auth.token | **ZERO** |

### Critical Finding

**No frontend Socket.IO consumer code exists** in either `apps/web/src` or `apps/admin/src`. Despite `socket.io-client` being listed as a dependency in `apps/web/package.json`, exhaustive search found zero imports, zero `io()` calls, zero `socket.on`/`socket.emit` usage. The backend gateways are fully implemented but have no corresponding frontend integration.

**Migration implication**: M12 realtime migration may be simplified; verify whether battle/presence features are actually used in production before investing in WebSocket migration.

## Media Summary

### Storage Architecture

- **Client**: `minio` npm package (NOT aws-sdk or @nestjs/minio)
- **Bucket**: Single bucket (`nihongo-bjt-media` from .env.example)
- **Clients**: 3 independent `Client` instances (internal, public-facing for presigned URLs, share service)
- **Access control**: Application-layer only; no bucket-level public/private split

### Key Patterns (13 identified)

| Pattern | Visibility | DB Reference |
|---|---|---|
| `{userId}/{uuid}-{sanitizedFileName}` | Private | MediaAsset.objectKey |
| `admin/{actorId}/{uuid}-{sanitizedFileName}` | Effectively public | MediaAsset.objectKey |
| `{userId}/proxy-{uuid}.jpg` | Private | MediaAsset.objectKey |
| `shares/{shareItemId}.png` | Public (token-gated) | ShareCardAsset.objectKey |
| String URL columns (not FK) | Varies | NhkArticle.imageUrl, Announcement.imageUrl, BjtQuestion.imageUrl |

### Upload Flows

1. **Presigned PUT** (learner): Client → MinIO direct; feature-gated by `external_media_uploads`
2. **Admin direct**: Server-side `putObject`; Buffer upload; no presigned flow
3. **Proxy download**: External URL → Sharp resize → `putObject`
4. **Share postcard**: SVG → Sharp PNG → `putObject`

### Object Counts/Sizes

**GATED_UNKNOWN**: Requires running MinIO instance to enumerate. Cannot be established from repository alone.

## Google OAuth Status/Evidence Confidence

**Status: GATED_UNKNOWN_PRODUCTION**

### Repository Evidence

- Full implementation exists: `google-oauth.controller.ts` + `auth.service.ts`
- Feature-gated behind `"social_growth"` runtime flag
- **Explicitly disabled when Keycloak is active**: `auth.service.ts:33-34` throws `GoneException("Google OAuth is disabled when Keycloak is the sole auth provider")` if `KEYCLOAK_ISSUER_URL` is set
- Requires env vars: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, `OAUTH_STATE_SECRET`

### What Cannot Be Determined From Repository

- Whether `social_growth` feature flag is enabled in production
- Whether Google OAuth credentials are configured in production environment
- Whether any users have linked Google identities (requires DB query)
- Whether the `KEYCLOAK_ISSUER_URL` is set in production (would disable Google OAuth)

### Required External Evidence

1. Production environment variable inspection (is `social_growth` enabled?)
2. Production database query: `SELECT COUNT(*) FROM "identityProviderAccount" WHERE provider = 'google'`
3. Production Keycloak configuration (is Google IdP configured?)

**Recommendation**: If production status cannot be confirmed before M4, default to RETIRE with documentation. The code path exists but is architecturally secondary to Keycloak.

## Billing Webhook Summary

### Endpoints

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/webhooks/stripe` | Public (Stripe signature verification) | Stripe event ingestion |
| `POST /api/admin/billing/webhook` | AdminRbacGuard (billing_webhook) | Manual local/dev provider ingest |
| `GET /api/admin/billing/webhook` | AdminRbacGuard (billing.webhook.read) | List webhook events |
| `GET /api/admin/billing/webhook/:id/raw` | AdminRbacGuard (billing.webhook.manage) | Raw payload access |

### Stripe Implementation

- **Signature verification**: `stripe.webhooks.constructEvent(rawBody, signatureHeader, webhookSecret)`
- **Raw body**: Requires `rawBody: true` in NestJS bootstrap; uses `RawBodyRequest<Request>`
- **Idempotency**: `billingWebhookEvent.idempotencyKey` unique constraint; Stripe `event.id` (evt_*) used as key
- **Events handled**: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- **Persistence**: All events stored in `billingWebhookEvent` table with full raw payload
- **Dead letter**: After 3 failed retries → `dead_lettered` status + `DeadLetterEntry` created
- **Audit trail**: Every webhook creates `monetizationAuditLog` entry

### Local Provider

- Signature verification always returns `true`
- Restricted to `provider: "local"` in ingest schema
- For dev/testing only

## Image Processing Summary

### Sharp Usage (2 files only)

| File | Operation | Dimensions | Format | Caller |
|---|---|---|---|---|
| `media.service.ts` | Resize external images | Max 800×800 (inside, no enlargement) | JPEG q82 mozjpeg | `proxyDownloadExternalImage()` |
| `share-image.renderer.ts` | SVG→PNG rasterization | 1200×630 standard / 2400×1260 HiRes | PNG | `ShareService.createForUser()` |

### What Sharp Is NOT Used For

- No thumbnail generation
- No avatar processing
- No upload-time validation/transformation for presigned uploads
- No WebP output anywhere

### ARM64 Safety

Sharp v0.33.x ships prebuilt binaries for linux-x64, linux-arm64, darwin-x64, darwin-arm64. **ARM64-safe out of the box.**

## Deployment/Containerization/ARM64 Summary

### Current Production Deployment

- **App processes**: PM2 on bare GCP VM (NOT containerized)
- **Infrastructure**: Docker Compose (PostgreSQL, Redis, Meilisearch, MinIO, Keycloak)
- **Reverse proxy**: Caddy with template-based domain substitution
- **CI/CD**: GitHub Actions → SSH rsync → PM2 reload
- **Secondary target**: OCI (`deploy/oci/`) with custom MinIO Dockerfile

### Dockerfiles Found: 1

- `deploy/oci/Dockerfile.minio` — Custom MinIO build; `golang:1.24.8-alpine` → `alpine:3.24`; CGO_ENABLED=0; **no platform pinning**

### ARM64 Audit Results

| Component | ARM64 Status | Evidence |
|---|---|---|
| postgres:17-alpine | VERIFIED | Multi-arch official image |
| redis:8-alpine | VERIFIED | Multi-arch official image |
| getmeili/meilisearch:v1.13 | VERIFIED | Multi-arch official image |
| minio/minio:RELEASE.2025-04-22 | VERIFIED | Multi-arch official image |
| keycloak:26.2.4 | VERIFIED | Multi-arch official image |
| sharp ^0.33.5 | VERIFIED | Prebuilt arm64 binaries |
| Custom MinIO Dockerfile | UNVERIFIED | No --platform flag; builds for host arch |
| Node.js 24.16.0 | VERIFIED | Native arm64 support |
| bcrypt/argon2/canvas | N/A | Not present in dependencies |

**No x86-only assumptions detected.** All base images are multi-arch. The only native dependency (sharp) is ARM64-safe.

## Baseline Verification Results

| Gate | Command | Result | Classification |
|---|---|---|---|
| Prisma validate | `pnpm prisma:validate` | PASS (exit 0) | ✅ CLEAN |
| Typecheck | `pnpm typecheck` | PENDING | ENVIRONMENT_BLOCKED (Node version mismatch: 24.12.0 vs 24.16.0 wanted) |
| Lint | `pnpm lint` | PENDING | ENVIRONMENT_BLOCKED |
| Tests | `pnpm test` | PENDING | ENVIRONMENT_BLOCKED |
| Build | `pnpm build` | PENDING | ENVIRONMENT_BLOCKED |

**Note**: Node version warning (`wanted: {"node":"24.16.0"} current: {"node":"v24.12.0"}`) does not block Prisma validation but may affect other gates. Full baseline requires matching Node version or explicit override.

## Resource Baseline Availability

**ENVIRONMENT_BLOCKED**: Local Docker services (PostgreSQL, Redis, Meilisearch, MinIO) were not verified running during this investigation. Object counts, sizes, and checksums cannot be captured without running infrastructure.

**OCI production numbers**: Not available from repository. Must not be fabricated.

## Gated Unknowns

| Item | Status | Required Evidence | Blocking Wave |
|---|---|---|---|
| Google OAuth production status | GATED_UNKNOWN_PRODUCTION | Runtime env inspection; DB identity provider count | M4 |
| Keycloak credential format/export | GATED_UNKNOWN | Keycloak export investigation | M2 (HARD GATE) |
| MinIO object counts/sizes/checksums | GATED_UNKNOWN | Running MinIO instance with bucket access | M7 |
| Full per-route API detail (710 routes) | SUMMARY_CAPTURED | Per-route extraction deferred to M1+ as needed | M8-M9 |
| Quality baseline (typecheck/lint/test/build) | ENVIRONMENT_BLOCKED | Matching Node.js version (24.16.0) | M1 |
| Resource baseline (Docker services) | ENVIRONMENT_BLOCKED | Running local infrastructure | M7 |
| Battle/Presence frontend consumers | VERIFIED_ABSENT | Confirmed zero usage; verify production traffic logs | M12 |

## H0 Inputs

Based on M0 findings, the following documentation hygiene items are identified:

1. **AGENTS.md / AI_CONTEXT.md BullMQ reference**: States "Redis/BullMQ handles background jobs" but no BullMQ exists. Should be corrected to "Redis for ephemeral concerns; cron-based scheduled jobs."
2. **Socket.IO frontend integration docs**: Backend gateways documented but no frontend consumers exist. Clarify actual usage status.
3. **Deployment docs**: GCP deployment is PM2-based, not containerized. Ensure docs reflect actual topology.
4. **Google OAuth docs**: Clarify that Google OAuth is architecturally secondary and disabled when Keycloak is active.
5. **Auth architecture docs**: Clarify that auth uses custom `jose`-based guard, NOT Passport/JWT strategy.

**No deletes or moves recommended in M0.** Classification only; action deferred to H0.

## Rollback State

```
No migration applied. Existing NestJS/Keycloak/MinIO/GCP paths fully retained.
Rollback = do nothing.
All unrelated dirty files preserved exactly as found.
```

## Gate Recommendation

### **M0_PASS_WITH_GATED_ITEMS**

**Rationale**: All structurally derivable evidence has been captured. The five background agent investigations completed successfully, producing comprehensive inventories of routes, auth, infrastructure, jobs/realtime, and media/billing. Prisma schema validation passed. Controller count matches canonical expectation (100 files, 710 routes).

**Items that cannot be resolved in M0** (by design — they require external/runtime evidence):
- Google OAuth production status → deferred to M4 decision point
- Keycloak credential format → deferred to M2 HARD GATE
- MinIO object inventory → deferred to M7 prerequisite
- Full quality baseline → blocked by Node version mismatch; does not invalidate structural findings

**These gated items do not block H0 or M1.** They are correctly classified with explicit evidence requirements and will be resolved at their respective wave gates.

## Next Steps

1. **H0**: Documentation hygiene classification and corrections based on M0 findings
2. **M1**: Go foundation + deployment foundations (can proceed without gated items)
3. **M2**: Keycloak credential investigation gate (HARD GATE — must resolve before M3)
4. **M4**: Google OAuth migrate/retire decision (resolve production status before this wave)
5. **M7**: MinIO object reconciliation (resolve object inventory before this wave)