# Backend API Production Audit

## Shared Snapshot (BJT-101)

- Snapshot date: 2026-04-29 JST
- Scope: docs-only convergence against current backend artifacts and route evidence.
- Evidence basis: `docs/openapi.json`, `apps/api/src/openapi/openapi-generation.test.ts`, `docs/CURSOR_BACKEND_API_HANDOFF.md`, `docs/BACKEND_API_PRODUCTION_CHECKLIST.md`
- Confidence: partial (evidence-backed docs reconciliation; no new runtime verification in this task)

Audit date: 2026-04-29 JST  
Canonical source: `docs/spec/nihongo_bjt_cursor_master_spec_final_completed_v2.md` (v15)  
Scope: backend API only (`apps/api`, Prisma schema/migrations, shared DTO/Zod schemas, Swagger/OpenAPI, tests)

Legend:

- Controller/service/DTO/validation/tests: `yes`, `no`, or `partial`.
- Auth guard: `public`, `JWT`, `admin`, `permission`, or `missing`.
- Swagger/response/error schema: `yes` only when the route has explicit production-grade documentation; `partial` means tags/operation exist but concrete response/body/error DTOs are incomplete.
- Production status: `complete`, `partial`, `missing`, or `unsafe`.
- Priority: `P0` blocks safe backend continuation, `P1` required for MVP v1, `P2` contract scaffold acceptable, `P3` future.

## Shared Status Legend

- `complete`: canonical v15 family exists on current backend routes and is usable.
- `partial`: family exists but is incomplete (missing sub-endpoints, DTO/schema depth, tests, or full enforcement).
- `missing`: family is not production-ready in the current backend snapshot.

## Endpoint Family Status (Converged)

| Family | Status | Notes |
|---|---|---|
| `/api/auth/profile` | complete | Canonical profile sync/read/update is implemented. |
| `/api/dictionary/*`, `/api/kanji/*`, `/api/grammar/*`, `/api/examples/*`, `/api/vija/search` | partial | Canonical aliases exist; response/test maturity still incomplete. |
| `/api/bookmarks/*` | partial | Implemented with persistence; list hydration/contract depth still pending. |
| `/api/decks/*`, `/api/review/*` | partial | Canonical aliases implemented; deck CRUD/presets and stronger contracts still pending. |
| `/api/flashcards/cards/:id/images/*` | partial | Upload/link exists; external search/select and hardened media pipeline incomplete. |
| `/api/admin/operations/feature-flags/*` | partial | List/update exists with RBAC + audit; rollout/runtime enforcement still maturing. |
| `/api/admin/operations/kill-switches/*` | partial | List/update exists with RBAC + audit; propagation/runtime enforcement still pending. |
| `/api/admin/operations/dead-letter-queue/*` | partial | List/resolve/discard exists; retry worker integration still pending. |
| `/api/legal/*`, `/api/consent/*` | partial | Baseline consent status/accept APIs are implemented; broader legal/privacy family is still incomplete. |
| `/api/privacy/*` | partial | Privacy requests exist via learner routes; canonical prefix alignment still pending. |
| `/api/auth/oauth/*`, `/api/referrals/*`, `/api/share/*` | partial | Real flows exist mostly under legacy/adjacent prefixes. |
| `/api/admin/imports/*`, `/api/admin/notifications/*` | missing | Admin APIs not production-ready in current snapshot. |

## Explicit Gate Evidence Links

- OpenAPI snapshot: `docs/openapi.json`
- OpenAPI generation test: `apps/api/src/openapi/openapi-generation.test.ts`
- Backend handoff evidence: `docs/CURSOR_BACKEND_API_HANDOFF.md`
- Production checklist evidence: `docs/BACKEND_API_PRODUCTION_CHECKLIST.md`
- Operations baseline paths in OpenAPI: `/api/admin/operations/feature-flags`, `/api/admin/operations/kill-switches`, `/api/admin/operations/dead-letter-queue`

Current-truth note: the converged family table above is authoritative for this snapshot.

Release-decision rule:
- Use only the converged family table in this document for `complete|partial|missing` decisions.
- Do not use historical row-level `Status/Priority` cells below as current release truth.

Historical tracker note:
- Detailed matrices below are archived pre-convergence trackers retained for migration context.
- Any row-level mismatch with the converged family table is expected until a dedicated row-by-row cleanup cycle.

## Executive Summary

The API has real production slices for health, Keycloak-ready auth, content browse/search, flashcards/SRS, quiz, admin CMS/audit/users, monetization/ads, growth/share, analytics, media, daily hub, and reading assist. The implementation is not a fake UI-only backend.

The main production gaps are:

- v15 route-shape mismatch: several implemented APIs live under older prefixes (`/content`, `/flashcards`, `/learner`, `/public`, `/auth/google`) instead of v15 canonical prefixes.
- P1 families remain mixed: `/auth/profile` is complete, while `/dictionary/*`, `/bookmarks/*`, `/decks/*`, `/review/*`, admin operations, and legal/consent are partial; some admin families remain missing.
- Swagger is broad but not production complete for every endpoint: many routes have tags/operations but missing typed body/response/error decorators.
- DTOs are mostly Zod schemas in `@nihongo-bjt/shared`, not class-validator DTO classes with property-level Swagger metadata.
- Tests cover core pure logic and a few guards/utilities, but controller/contract/security/integration coverage is incomplete.
- Feature flags exist in schema/seed but are not enforced by a backend service/guard.

## Core Learner APIs (Archived Pre-Convergence Tracker)

### 1. Auth/User

| Method | Path | Controller exists? | Service exists? | DTO exists? | Validation exists? | Auth guard | RBAC permission | Swagger complete? | Response schema | Error schema | Tests | Real/placeholder | Status | Priority | Notes |
|---|---|---:|---:|---:|---:|---|---|---:|---:|---:|---:|---|---|---|---|
| POST | `/auth/register` | no | partial | no | no | public | n/a | no | no | no | no | missing | missing | P1 | Registration currently handled by Keycloak web callbacks/OAuth, not v15 API. |
| POST | `/auth/profile` | no | partial | no | no | JWT | n/a | no | no | no | no | missing | missing | P0 | Needed as canonical profile sync alias over current Keycloak user/profile model. |
| GET | `/auth/profile` | no | partial | no | no | JWT | n/a | no | no | no | no | missing | missing | P0 | Current equivalent is `GET /auth/me`. |
| PUT | `/auth/profile` | no | partial | no | no | JWT | n/a | no | no | no | no | missing | missing | P0 | Profile update exists in admin/user areas only partially. |
| GET | `/auth/me` | yes | yes | n/a | n/a | JWT | n/a | partial | no | partial | no | real | partial | P1 | Existing route; should be documented as legacy/internal alias after `/auth/profile`. |
| GET/DELETE | `/auth/identities*` | yes | yes | partial | yes | JWT | n/a | partial | no | partial | no | real | partial | P2 | Social identity management is real and token-safe. |

### 2-7. Dictionary, Kanji, Grammar, Examples, ViJa, Global Search

| Method | Path | Controller exists? | Service exists? | DTO exists? | Validation exists? | Auth guard | RBAC permission | Swagger complete? | Response schema | Error schema | Tests | Real/placeholder | Status | Priority | Notes |
|---|---|---:|---:|---:|---:|---|---|---:|---:|---:|---:|---|---|---|---|
| GET | `/dictionary/search` | no | yes | partial | yes | public | n/a | no | no | no | no | real via alias missing | missing | P1 | Current data path is `/content/lexemes` or `/search`. |
| GET | `/dictionary/words/:id` | no | partial | no | no | public | n/a | no | no | no | no | missing detail | missing | P1 | Detail by id not exposed for lexeme. |
| GET | `/kanji` | no canonical | yes | partial | yes | public | n/a | partial | no | partial | no | real via `/content/kanji` | partial | P1 | Needs v15 alias and query docs. |
| GET | `/kanji/search` | no canonical | yes | partial | yes | public | n/a | partial | no | partial | no | real via `/content/kanji?q=` | partial | P1 | Needs canonical alias. |
| GET | `/kanji/:id` | no | partial | no | no | public | n/a | no | no | no | no | missing detail | missing | P1 | Detail route missing. |
| GET | `/grammar` | no canonical | yes | partial | yes | public | n/a | partial | no | partial | no | real via `/content/grammar` | partial | P1 | Needs canonical alias. |
| GET | `/grammar/:id` | no | partial | no | no | public | n/a | no | no | no | no | missing detail | missing | P1 | Detail route missing. |
| GET | `/examples` | no canonical | yes | partial | yes | public | n/a | partial | no | partial | no | real via `/content/examples` | partial | P1 | Needs canonical alias. |
| GET | `/examples/by-word/:wordId` | no | partial | no | no | public | n/a | no | no | no | no | missing | missing | P1 | Needs lexeme/example link query. |
| GET | `/examples/search` | no canonical | yes | partial | yes | public | n/a | partial | no | partial | no | real via `/content/examples?q=` | partial | P1 | Needs canonical alias with `keyword`. |
| GET | `/vija/search` | no | partial | partial | no | public | n/a | no | no | no | no | missing | missing | P1 | Reverse projection model exists but endpoint missing. |
| GET | `/search` | yes | yes | yes | yes | public | n/a | partial | no | partial | no | real | partial | P1 | Meilisearch fallback exists; response should expose/document degraded flag. |

### 8. BJT Levels

| Method | Path | Controller | Service | DTO | Validation | Auth | RBAC | Swagger | Response | Error | Tests | Real/placeholder | Status | Priority | Notes |
|---|---|---:|---:|---:|---:|---|---|---:|---:|---:|---:|---|---|---|---|
| GET | `/levels/:level` | no | no | no | no | public | n/a | no | no | no | no | missing | missing | P1 | No BJT level read API. |
| GET | `/levels/:level/vocabulary` | no | partial | no | no | public | n/a | no | no | no | no | missing | missing | P1 | Can be built from content metadata but not exposed. |
| GET | `/levels/:level/kanji` | no | partial | no | no | public | n/a | no | no | no | no | missing | missing | P1 | Kanji `level` exists. |
| GET | `/levels/:level/grammar` | no | partial | no | no | public | n/a | no | no | no | no | missing | missing | P1 | Grammar `jlptLevel` exists, BJT taxonomy incomplete. |

### 9. Bookmarks

| Method | Path | Controller | Service | DTO | Validation | Auth | RBAC | Swagger | Response | Error | Tests | Real/placeholder | Status | Priority | Notes |
|---|---|---:|---:|---:|---:|---|---|---:|---:|---:|---:|---|---|---|---|
| GET | `/bookmarks/check/:type/:id` | no | no | no | no | JWT | n/a | no | no | no | no | missing | missing | P1 | `learning.bookmark` missing from Prisma. |
| POST | `/bookmarks/:type/:id` | no | no | no | no | JWT | n/a | no | no | no | no | missing | missing | P1 | Needs DB model/migration and auth. |
| GET | `/bookmarks/words` | no | no | no | no | JWT | n/a | no | no | no | no | missing | missing | P1 | Missing. |
| GET | `/bookmarks/kanji` | no | no | no | no | JWT | n/a | no | no | no | no | missing | missing | P1 | Missing. |
| GET | `/bookmarks/grammar` | no | no | no | no | JWT | n/a | no | no | no | no | missing | missing | P1 | Missing. |

### 10-12. Decks, Flashcards/Cards, Review/SRS

| Method | Path | Controller | Service | DTO | Validation | Auth | RBAC | Swagger | Response | Error | Tests | Real/placeholder | Status | Priority | Notes |
|---|---|---:|---:|---:|---:|---|---|---:|---:|---:|---:|---|---|---|---|
| GET | `/decks` | no canonical | yes | yes | yes | JWT | n/a | partial | no | partial | no | real via `/flashcards/decks` | partial | P1 | Needs canonical alias. |
| POST | `/decks` | no canonical | yes | yes | yes | JWT | n/a | partial | no | partial | no | real via `/flashcards/decks` | partial | P1 | Needs entitlement/quota for deck create. |
| GET | `/decks/presets` | no | no | no | no | public | n/a | no | no | no | no | missing | missing | P1 | Preset deck/admin support incomplete. |
| POST | `/decks/presets/:id/clone` | no | no | no | no | JWT | n/a | no | no | no | no | missing | missing | P1 | Missing. |
| GET/PUT/DELETE | `/decks/:id` | no | partial | no | no | JWT | n/a | no | no | no | no | partial | missing | P1 | List/create exist; detail/update/delete missing. |
| GET/POST/DELETE | `/decks/:deckId/cards*` | no canonical | partial | yes | yes | JWT | n/a | partial | no | partial | no | partial | partial | P1 | Add-card exists only as `/flashcards/cards/from-content`; list/remove missing. |
| GET | `/review/next` | no canonical | yes | yes | yes | JWT | n/a | partial | no | partial | partial | real via `/flashcards/reviews/due` | partial | P1 | Needs canonical alias. |
| POST | `/review` | no canonical | yes | yes | yes | JWT | n/a | partial | no | partial | yes unit | real via `/flashcards/reviews/:id` | partial | P1 | Needs canonical alias and idempotency key. |
| GET | `/review/summary` | no | partial | no | no | JWT | n/a | no | no | no | no | missing | missing | P1 | Missing daily summary. |
| POST/GET/DELETE | `/flashcards/cards/:id/images*` | partial | partial | yes | yes | JWT | n/a | partial | no | partial | no | partial | partial | P1 | Upload/link exists; search/select external candidates missing and must not fake. |

### 13-16. Study, Progress, Achievements, NHK

| Method | Path | Controller | Service | DTO | Validation | Auth | RBAC | Swagger | Response | Error | Tests | Real/placeholder | Status | Priority | Notes |
|---|---|---:|---:|---:|---:|---|---|---:|---:|---:|---:|---|---|---|---|
| POST/PUT | `/study/sessions*` | no canonical | partial | partial | partial | JWT | n/a | partial | no | partial | no | partial via learner/daily | partial | P1 | `study_session` model missing; daily/placement exist. |
| GET | `/study/stats*` | no canonical | partial | partial | partial | JWT | n/a | partial | no | partial | no | partial | partial | P1 | Analytics learner endpoint exists but not v15 study paths. |
| GET | `/study/streak` | no | no | no | no | JWT | n/a | no | no | no | no | missing | missing | P1 | Missing. |
| GET | `/study/heatmap` | no | partial | no | no | JWT | n/a | no | no | no | no | missing | missing | P1 | Rollups exist but route missing. |
| GET | `/progress/dashboard` | no | partial | no | no | JWT | n/a | no | no | no | no | missing | missing | P1 | Missing. |
| GET | `/achievements*` | no | no | no | no | JWT | n/a | no | no | no | no | missing | missing | P2 | Not MVP v1 cutline except scaffold. |
| GET/POST | `/nhk-news*` | no | no | no | no | public/JWT | n/a | no | no | no | no | missing | missing | P2 | External provider/caching needed; no fake success allowed. |

### 17. Quiz/BJT Mock Exam

| Method | Path | Controller | Service | DTO | Validation | Auth | RBAC | Swagger | Response | Error | Tests | Real/placeholder | Status | Priority | Notes |
|---|---|---:|---:|---:|---:|---|---|---:|---:|---:|---:|---|---|---|---|
| GET | `/quiz/templates` | yes | yes | partial | partial | JWT currently | n/a | partial | no | partial | no | real | partial | P1 | Spec says public; controller-level JWT currently protects all quiz routes. |
| GET | `/quiz/templates/:id` | yes | yes | partial | yes | JWT currently | n/a | partial | no | partial | no | real | partial | P1 | Should be public or explicitly documented. |
| POST | `/quiz/start` | yes | yes | yes | yes | JWT | n/a | partial | no | partial | yes unit | real | partial | P1 | Quota enforcement added via transactional `QuizService.startSessionWithQuota` and `QuotaService.consumeQuizStartInTransaction` (`quiz.bjt.start`) with rollback safety. |
| GET | `/quiz/session/:id/question` | yes | yes | partial | partial | JWT | n/a | partial | no | partial | no | real | partial | P1 | Needs response schema and ownership tests. |
| POST | `/quiz/session/:id/answer` | yes | yes | yes | yes | JWT | n/a | partial | no | partial | partial | real | partial | P1 | Estimated scoring helper tested. |
| GET | `/quiz/session/:id/results` | yes | yes | partial | partial | JWT | n/a | partial | no | partial | yes unit | real | partial | P1 | Must document estimated score/band as estimated. |
| POST | `/quiz/session/:id/abandon` | no | no | no | no | JWT | n/a | no | no | no | no | missing | missing | P1 | Missing. |
| GET | `/quiz/history` | no | partial | no | no | JWT | n/a | no | no | no | no | missing | missing | P1 | Missing. |

### 18. Battle REST

| Method | Path | Controller | Service | DTO | Validation | Auth | RBAC | Swagger | Response | Error | Tests | Real/placeholder | Status | Priority | Notes |
|---|---|---:|---:|---:|---:|---|---|---:|---:|---:|---:|---|---|---|---|
| GET | `/battle/configs` | no | partial | no | no | JWT | n/a | no | no | no | no | missing | missing | P2 | Only `/battle/sessions/recent` exists. |
| GET | `/battle/leaderboard*` | no | no | no | no | JWT | n/a | no | no | no | no | missing | missing | P2 | Missing. |
| GET | `/battle/history*` | partial | partial | yes | yes | JWT | n/a | partial | no | partial | no | real via `/sessions/recent` | partial | P2 | Needs v15 route shape and detail. |
| GET | `/battle/stats` | no | no | no | no | JWT | n/a | no | no | no | no | missing | missing | P2 | Missing. |
| GET | `/battle/ranks` | no | no | no | no | JWT | n/a | no | no | no | no | missing | missing | P2 | Missing. |

## Realtime APIs

| Group | Events/Path | Controller/Gateway | Service | DTO | Validation | Auth guard | RBAC | Swagger | Tests | Real/placeholder | Status | Priority | Notes |
|---|---|---:|---:|---:|---:|---|---|---:|---:|---|---|---|---|
| 19 Socket.IO battle namespace | `/battle` | yes | yes | partial | partial | partial | n/a | n/a | partial shared | real | partial | P2 | Gateway exists but not full v15 event surface. |
| 20 Lobby events | `lobby:*` | partial | partial | partial | partial | partial | n/a | n/a | no | partial | partial | P2 | Online/chat/rate limit semantics need verification. |
| 21 Matchmaking/challenge | challenge/bot events | partial | partial | yes | partial | partial | n/a | n/a | partial | real | partial | P2 | Bot challenge exists; PvP incomplete. |
| 22 Room events | answer/round/result | partial | partial | yes | partial | partial | n/a | n/a | partial | real | partial | P2 | Room fairness/idempotency incomplete. |
| 23 Reconnect/fairness/idempotency | reconnect/session resume | no | partial | no | no | missing | n/a | n/a | no | missing | missing | P2 | Needs explicit contracts and tests. |

## Admin APIs

| Group | Representative paths | Controller | Service | DTO | Validation | Auth guard | RBAC | Swagger | Response | Error | Tests | Real/placeholder | Status | Priority | Notes |
|---|---|---:|---:|---:|---:|---|---|---:|---:|---:|---:|---|---|---|---|
| 24 Dashboard | `/admin/dashboard` | no exact | partial | no | no | admin | partial | no | no | no | no | missing | missing | P1 | Existing `/admin/session`, `/admin/me`, content/user KPIs but no dashboard route. |
| 25 Users | `/admin/users*` | yes | yes | yes | yes | admin | yes | partial | partial | partial | no | real | partial | P1 | Admin user writes audited. Needs route tests. |
| 26 Content words/kanji/grammar/examples | `/admin/content*`, `/admin/lexemes/*/examples` | yes | yes | yes | yes | admin | yes | partial | no | partial | no | real | partial | P1 | v15 word-specific paths missing but generic CRUD real/audited. |
| 27 Presets | `/admin/presets*` | no | no | no | no | admin | no | no | no | no | no | missing | missing | P1 | Missing. |
| 28 Quiz admin | `/admin/quiz/*` | no | partial | no | no | admin | no | no | no | no | no | missing | missing | P1 | Public quiz exists; admin builder missing. |
| 29 Battle admin | `/admin/battle/*` | no | partial | no | no | admin | no | no | no | no | no | missing | missing | P2 | Missing. |
| 30 Imports | `/admin/imports*` | no | partial | no | no | admin | no | no | no | no | no | missing | missing | P1 | Staging schema exists; API missing. |
| 31 Enrichment | `/admin/enrichment*` | no | no | no | no | admin | no | no | no | no | no | missing | missing | P2 | Missing. |
| 32 Audit | `/admin/audit` | yes | yes | partial | yes | admin | yes | partial | no | partial | no | real | partial | P1 | Needs response DTO and access tests. |
| 33 Analytics | `/admin/analytics` | yes | yes | yes | yes | admin | yes | partial | no | partial | no | real | partial | P1 | Rollup-backed. |
| 34 IAM roles | `/admin/iam/roles` | no exact | partial | no | no | admin | partial | no | no | no | no | missing | missing | P1 | `/admin/me` returns permissions; role mapping API missing. |
| 35 Media | `/media/*`, admin media | partial | yes | yes | yes | JWT | n/a | partial | no | partial | no | real | partial | P1 | Learner media exists; admin media moderation API missing. |
| 36 i18n | `/admin/i18n*` | no | partial | no | no | admin | no | no | no | no | no | missing | missing | P1 | l10n tables exist; API missing. |
| 37 Operations | `/admin/operations/*` | no | partial | no | no | admin | no | no | no | no | no | missing | missing | P0 | Feature flags/DLQ schema exists; API/service missing. |

## Additional V15 APIs From Section 10.1

| Group | Prefix | Controller | Service | DTO | Validation | Auth guard | RBAC | Swagger | Response | Error | Tests | Real/placeholder | Status | Priority | Notes |
|---|---|---:|---:|---:|---:|---|---|---:|---:|---:|---:|---|---|---|---|
| 38 Learning Paths learner | `/learning-paths/*` | no | no | no | no | JWT | n/a | no | no | no | no | missing | missing | P2 | Scaffold only acceptable after P1 foundations. |
| 39 Learning Paths admin | `/admin/learning-paths/*` | no | no | no | no | admin | no | no | no | no | no | missing | missing | P2 | Missing. |
| 40 Reading Assist | `/reading-assist/*` | yes | yes | yes | yes | JWT | n/a | partial | no | partial | guard tests | real | partial | P2 | Real implementation; cache/known-term models missing. |
| 41 Feature Flags admin | `/admin/operations/feature-flags/*` | no | partial schema | no | no | admin | no | no | no | no | no | missing | missing | P0 | Must be implemented for production baseline. |
| 42 Kill Switches admin | `/admin/operations/kill-switches/*` | no | partial schema | no | no | admin | no | no | no | no | no | missing | missing | P0 | Must log audit reason. |
| 43 Dead-Letter Queue admin | `/admin/operations/dead-letter-queue/*` | no | partial schema | no | no | admin | no | no | no | no | no | missing | missing | P1 | Schema exists. |
| 44 Content Versions admin | `/admin/content-versions/*` | no | no | no | no | admin | no | no | no | no | no | missing | missing | P2 | Missing. |
| 45 Monetization learner | `/monetization/*` | no canonical | yes | yes | yes | JWT | n/a | partial | no | partial | partial | real via `/learner/monetization/*` | partial | P1 | Needs canonical aliases or documented legacy. |
| 46 Billing APIs | `/billing/*` | no | partial providers | no | no | JWT | n/a | no | no | no | no | missing | missing | P2 | No real payment provider; do not fake. |
| 47 Admin monetization | `/admin/monetization/*` | yes | yes | yes | yes | admin | yes | partial | no | partial | partial | real | partial | P1 | Strongest admin module; add DTO docs/tests. |
| 48 OAuth/social login | `/auth/oauth/*` | no canonical | yes | partial | yes | public/JWT | n/a | partial | no | partial | yes utility | real via `/auth/google/*` | partial | P2 | Needs canonical provider abstraction prefix. |
| 49 Referrals | `/referrals/*` | no canonical | yes | yes | yes | JWT/public | n/a | partial | no | partial | no | real via `/learner/referral`, `/public/referral/:code` | partial | P2 | Prefix mismatch. |
| 50 Share/Postcards | `/share/*` | no canonical | yes | yes | yes | JWT/public | n/a | partial | no | partial | no | real via `/learner/share`, `/public/shares/*` | partial | P2 | Prefix mismatch. |
| 51 Legal | `/legal/*` | no | no | no | no | public/JWT | n/a | no | no | no | no | missing | missing | P1 | Required before production registration. |
| 52 Consent | `/consent/*` | no | no | no | no | JWT/public | n/a | no | no | no | no | missing | missing | P1 | Cookie/user consent missing. |
| 53 Privacy | `/privacy/*` | no canonical | partial | yes | yes | JWT | n/a | partial | no | partial | no | partial via `/learner/privacy/requests` | partial | P1 | Needs canonical prefix and legal models. |
| 54 Notifications admin | `/admin/notifications/*` | no | partial learner pref | yes | yes | admin | no | no | no | no | no | missing | missing | P2 | Learner notifications exist; admin ops missing. |

## Current Implemented Extra Routes

| Method | Path | Classification | Status | Notes |
|---|---|---|---|---|
| GET | `/health/live`, `/health/ready`, `/health/version` | should-document | complete | Production health routes; not in Section 10 but required by v15 infrastructure. |
| GET | `/content/summary`, `/content/lexemes`, `/content/kanji`, `/content/grammar`, `/content/examples` | legacy | partial | Real DB-backed content APIs; v15 wants dictionary/kanji/grammar/examples prefixes. |
| GET | `/auth/me` | legacy | partial | Should remain as compatibility alias for `/auth/profile`. |
| GET/DELETE/POST | `/auth/identities*`, `/auth/link/exchange`, `/auth/google/*` | should-document | partial | Real social login/linking; prefix differs from v15 `/auth/oauth/*`. |
| GET/POST | `/learner/*` | should-document | partial | Onboarding, placement, notifications, privacy; many are v15 adjacent. |
| GET/POST | `/daily/*`, `/admin/daily/*` | should-document | partial | Daily life hub from prior phases, not in Section 10 core registry. |
| GET/POST | `/ads/*`, `/admin/ads/*` | should-document | partial | Ads runtime/admin extensions under monetization. |
| GET/POST | `/public/shares/*`, `/public/referral/*` | legacy | partial | v15 wants `/share/*` and `/referrals/*`. |

## Production Behavior Findings

- No MongoDB/Mongoose found.
- Most request validation uses Zod `safeParse`; this is real validation, but it does not satisfy the requested class-validator/Swagger property DTO standard.
- List endpoints generally cap limits through Zod, but admin list and some analytics routes need uniform max-limit documentation/tests.
- Private learner APIs are mostly protected by `KeycloakAuthGuard`; quiz templates are over-protected relative to spec.
- Admin APIs use `AdminAuthService.requirePermission`/`requireOneOfPermissions`; no global decorator metadata yet.
- Admin writes in admin repository, monetization, ads, and growth preview generally audit; coverage should be route-tested.
- Search has PostgreSQL fallback, but response contract does not expose degraded status.
- Media upload has presign/complete/link checks but lacks full MIME sniffing, extension allowlist, SVG sanitization, and malware scan provider.
- Feature flag/kill-switch management APIs exist, but runtime propagation/enforcement is still partial.
- Billing webhook/payment provider endpoints are not implemented; no fake success observed.

## Required P0/P1 Backend Fixes From This Audit

1. P0: Implement canonical `/auth/profile` POST/GET/PUT over real profile persistence. **Done in this pass.**
2. P0: Implement backend feature flag service and admin operations APIs for feature flags/kill switches. **Done in this pass for list/update and audit logging.**
3. P1: Add canonical content aliases and detail endpoints: `/dictionary/search`, `/dictionary/words/:id`, `/kanji*`, `/grammar*`, `/examples*`, `/vija/search`. **Done in this pass.**
4. P1: Add bookmark model/API. **Done in this pass with `learning.bookmark`.**
5. P1: Add canonical `/decks` and `/review` aliases over real flashcard/SRS services. **Done in this pass for list/create/detail/cards/due/submit/summary; update/delete still deferred.**
6. P1: Add OpenAPI generation to `docs/openapi.json` and add a failing test/script for generation. **Done in this pass.**
7. P1: Add controller/contract tests for auth/profile, dictionary/search/detail, bookmarks auth, SRS, quiz, RBAC/audit, feature flags, OpenAPI generation. **Partially done: schema contract and OpenAPI generation tests added; integration/controller DB tests remain.**
8. P1: Add legal/consent contracts before production signup/payment. **Baseline done in this pass; broader legal/privacy completion remains pending.**

## Post-Implementation Status Update

| Endpoint/group | New status | Notes |
|---|---|---|
| `/auth/profile` POST/GET/PUT | partial -> complete for MVP backend profile CRUD | Real Keycloak-authenticated profile read/update. User cannot mutate email/status/Keycloak linkage. |
| `/dictionary/search`, `/dictionary/words/:id` | missing -> partial | Real DB-backed search/detail. Response DTO docs still need deeper typed schemas. |
| `/kanji`, `/kanji/search`, `/kanji/:id` | partial/missing -> partial | Canonical aliases and detail now exist. |
| `/grammar`, `/grammar/:id` | partial/missing -> partial | Canonical aliases and detail now exist. |
| `/examples`, `/examples/search`, `/examples/by-word/:wordId` | partial/missing -> partial | Canonical aliases now exist. |
| `/vija/search` | missing -> partial | Real reverse projection query; depends on imported projection data. |
| `/bookmarks/*` | missing -> partial | Real persistence and auth. List returns bookmark rows, not hydrated target details yet. |
| `/decks`, `/decks/:id`, `/decks/:deckId/cards` | missing/partial -> partial | Canonical aliases over real flashcard tables. Update/delete/presets remain pending. |
| `/review/next`, `/review`, `/review/summary` | missing/partial -> partial | Canonical aliases over real SRS service and review events. |
| `/admin/operations/feature-flags/*` | missing -> partial | Real DB-backed list/update with RBAC and audit reason. |
| `/admin/operations/kill-switches/*` | missing -> partial | Real DB-backed list/update using feature flag kill-switch field and audit reason. |
| `/admin/operations/dead-letter-queue/*` | missing -> partial | Real DB-backed list/resolve/discard with RBAC and audit. Retry behavior remains pending. |
| `/api/legal/consent/status`, `/api/legal/consent/accept` | missing -> partial | Keycloak-guarded consent status/accept persisted in `legal.consent_record`; checkout now enforces legal consent prerequisite server-side. |
| Swagger/OpenAPI generation | partial -> improved | `pnpm openapi:generate` writes both `apps/api/openapi/openapi.json` and `docs/openapi.json`; test verifies generation path registration. |
