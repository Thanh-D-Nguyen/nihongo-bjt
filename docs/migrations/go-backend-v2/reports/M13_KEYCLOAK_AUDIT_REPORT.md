# M13 Keycloak Disable — Dependency Audit Report

## Status: REVISE — ACTIVE_RUNTIME Dependencies Remain

M13 cannot PASS until all ACTIVE_RUNTIME references are migrated to Go-native auth.
Keycloak remains the sole authentication provider for learner web, admin, mobile, and NestJS API.

## Audit Date

2026-09-30

## Methodology

Repository-wide grep for: `keycloak`, `oidc`, `jwks`, `KEYCLOAK_`, `realm/`, `keycloakSubject`, `auth.__DOMAIN__`, `access_token`, `refresh_token`.

Excluded: `node_modules/`, `.next/`, `dist/`, `generated/client/` (Prisma), `packages/database/prisma/migrations/`.

## ACTIVE_RUNTIME References by Component

### 1. Learner Web (`apps/web/`) — CRITICAL

**Auth Shell & Providers:**
- `app/[locale]/layout.tsx` — wraps entire app in `<KeycloakAuthShell>`
- `components/auth/keycloak-auth-provider.tsx` — provides `useKeycloakAuth()` hook (userId, accessToken, displayName, email)
- `components/auth/require-keycloak-auth.tsx` — route guard component

**Pages using `RequireKeycloakAuth` guard:**
- `battle/page.tsx`, `battle/match/page.tsx`
- `flashcards/page.tsx`, `flashcards/decks/[deckId]/page.tsx`
- `quiz/page.tsx`
- `magazine/loto/_components/loto-hub-client.tsx`
- `settings/reading/page.tsx`, `settings/privacy/page.tsx`, `settings/linked-accounts/page.tsx`, `settings/accounts/page.tsx`, `settings/notifications/page.tsx`

**Components using `useKeycloakAuth()`:**
- `saved/_components/saved-page-client.tsx` — userId
- `battle/_components/battle-runtime-provider.tsx` — accessToken, displayName, email, userId
- `settings/reading/_components/reading-assist-settings-client.tsx` — userId
- `settings/privacy/_components/privacy-settings-client.tsx` — userId
- `settings/linked-accounts/_components/accounts-settings-client.tsx` — userId
- `settings/appearance/_components/appearance-settings-client.tsx` — full auth object
- `settings/subscription/_components/subscription-settings-client.tsx` — userId
- `settings/accounts/_components/accounts-settings-client.tsx` — userId
- `settings/_components/settings-hub-client.tsx` — full auth object
- `settings/notifications/_components/notifications-settings-client.tsx` — userId
- `flashcards/_components/auto-gen-dialog.tsx` — userId
- `flashcards/_components/flashcards-page-client.tsx` — userId
- `flashcards/_components/review-session.tsx` — userId
- `flashcards/_components/deck-browser.tsx` — userId
- `flashcards/_components/flashcards-client.tsx` — userId
- `flashcards/_components/deck-detail-client.tsx` — userId
- `u/[userId]/_components/public-profile-client.tsx` — accessToken
- `quiz/_components/quiz-client.tsx` — userId
- `daily/[id]/daily-detail-client.tsx` — full auth object
- `search/_components/search-client.tsx` — userId
- `magazine/loto/_components/loto-hub-client.tsx` — accessToken

**BFF/API Routes (Next.js server-side):**
- `app/api/auth/me/route.ts` — reads Keycloak cookies, forwards to NestJS
- `app/api/auth/keycloak/password-login/route.ts` — OIDC password grant via `@nihongo-bjt/keycloak-oidc`
- `app/api/auth/keycloak/logout/route.ts` — backchannel token revocation
- `app/api/auth/keycloak/register/route.ts` — user creation via Keycloak Admin API
- `app/api/auth/keycloak/forgot-password/route.ts` — password reset via Keycloak Admin API
- `app/api/auth/keycloak/authorize/route.ts` — PKCE authorization redirect
- `app/api/auth/keycloak/session/route.ts` — session validation

**Registration flow:**
- `register/_components/register-form-client.tsx` — calls `/api/auth/keycloak/authorize` and `/api/auth/keycloak/register`

### 2. Admin (`apps/admin/`) — CRITICAL

**Auth Gate:**
- `app/[locale]/layout.tsx` — wraps in `<AdminKeycloakSessionGate>`, uses `isAccessTokenUsable`
- `_components/admin-keycloak-session-gate.tsx` — admin session validation

**BFF/API Routes:**
- `app/api/auth/keycloak/password-login/route.ts` — admin OIDC password grant
- `app/api/auth/keycloak/logout/route.ts` — admin token revocation
- `app/api/auth/keycloak/authorize/route.ts` — admin PKCE redirect
- `app/api/auth/keycloak/session/route.ts` — admin session validation with `refreshAccessToken`

**IAM/Admin Management UI:**
- `app/[locale]/iam/admins/iam-admins-client.tsx` — displays `keycloakSubject` column
- `app/[locale]/users/user-invite-modal.tsx` — create_keycloak_user / sync_existing_keycloak_user modes
- `app/[locale]/_components/overview/overview-sections.tsx` — keycloak_realm_admin health check
- `app/[locale]/_components/overview/overview-page.tsx` — sys_row_keycloak display

**i18n Messages (en/ja/vi):**
- Extensive Keycloak-specific user-facing strings (wrong credentials, invite modes, role hints, masked IDs)

**Environment:**
- `.env.local` — NEXT_PUBLIC_ADMIN_KEYCLOAK_URL, REALM, CLIENT_ID, ISSUER_URL, CLIENT_SECRET

### 3. NestJS API (`apps/api/`) — CRITICAL (Legacy Backend)

**Core Module:**
- `app.module.ts` — imports `KeycloakModule`
- `keycloak/keycloak.module.ts` — module definition
- `keycloak/keycloak-auth.guard.ts` — global auth guard
- `keycloak/current-user.decorator.ts` — `@CurrentUser()` decorator
- `keycloak/keycloak.types.ts` — `KeycloakAuthenticatedUser` type
- `keycloak/learner-identity.util.ts` — `resolveLearnerUserId()`

**Controllers using `@UseGuards(KeycloakAuthGuard)` (37 controllers):**
analytics, learning-heatmap, weekly-report, auth, battle, bookmarks, cardgen, career-rpg, companion, business-scenario, daily, exercise, canonical-flashcards, flashcard-styles, flashcards, gamification, seasonal-event, study-group, learner-growth, learner, legal-consent, loto-hub, media, ads-runtime, entitlement.guard, learner-monetization, nhk-news, push, privacy-request, public-profile, quiz, revenge-mode, reading-assist, onboarding, recommendation

**Total NestJS Keycloak references:** 687 lines

### 4. Mobile (`apps/mobile/`) — ACTIVE_RUNTIME

- `lib/core/config/app_environment.dart` — `keycloakIssuer` config, OIDC scopes, redirect URI, kc_idp_hint
- `lib/features/settings/domain/id_token_claims.dart` — OIDC ID token decoding
- `lib/l10n/gen/` — localized strings referencing Keycloak sessions

### 5. Shared Packages — ACTIVE_RUNTIME

**`packages/keycloak-oidc/`:**
- Full OIDC client library: password grant, PKCE, token refresh, revocation, error classification
- Used by both learner web and admin BFF routes

**`packages/config/src/index.js`:**
- 30+ Keycloak env var schemas (NEXT_PUBLIC_KEYCLOAK_*, KEYCLOAK_*, WEB_KEYCLOAK_*, ADMIN_KEYCLOAK_*)
- `publicKeycloakIssuerUrl()`, `isPublicKeycloakEnabled()` helpers

**`packages/shared/src/index.ts`:**
- `creationMode` enum includes `create_keycloak_user`, `sync_existing_keycloak_user`

### 6. Infrastructure / Deployment — CONFIGURATION

- `docker/keycloak/docker-compose.yml` — Keycloak 26.2.4 service definition
- `docker/keycloak/realm-export.json` — realm configuration with OIDC protocol mappers
- `.env.example` — 30+ Keycloak env var templates
- `apps/web/.env.example` — Keycloak OIDC server/client config templates

### 7. Go API (`apps/api-go/`) — TRANSITIONAL_SCHEMA Only

- `internal/profile/store.go` — `KeycloakSubject *string` field in profile queries (nullable, read-only)
- `internal/httpserver/handler_auth.go` — includes `sub` from `keycloakSubject` if present (backward compat)
- `internal/httpserver/handler_auth_test.go` — test helper accepts `keycloakSubject` parameter
- `internal/credential/argon2.go` — comment clarifying "NOT a Keycloak legacy verifier"

**Classification:** TRANSITIONAL_SCHEMA — no active Keycloak dependency; fields exist for data continuity during identity reset.

## Summary Classification

| Category | Count | Blocking? |
|----------|-------|-----------|
| ACTIVE_RUNTIME (learner web) | ~40 files | YES |
| ACTIVE_RUNTIME (admin) | ~15 files | YES |
| ACTIVE_RUNTIME (NestJS API) | 37 controllers, 687 refs | YES |
| ACTIVE_RUNTIME (mobile) | ~5 files | YES |
| ACTIVE_RUNTIME (shared packages) | 3 packages | YES |
| ACTIVE_RUNTIME (BFF routes) | 12 routes | YES |
| TRANSITIONAL_SCHEMA (Go API) | 3 files | NO |
| CONFIGURATION (infra/env) | ~6 files | DEFERRED |
| TEST_FIXTURE | 0 | NO |
| DOCUMENTATION | excluded | NO |
| DEAD_LEGACY | 0 | NO |

## Blocker for M13 PASS

**ACTIVE_RUNTIME count = ~115 files across 6 components.**

M13 requires ACTIVE_RUNTIME = 0 before Keycloak can be disabled.

### Required Pre-M13 Work (New Sub-Waves)

The following must be completed before M13 can proceed:

1. **M13a: Learner Web Auth Migration** — Replace `KeycloakAuthShell`, `useKeycloakAuth()`, `RequireKeycloakAuth` with Go-native session cookie auth. Migrate all BFF routes from Keycloak OIDC to Go API `/api/auth/*` endpoints.

2. **M13b: Admin Auth Migration** — Replace `AdminKeycloakSessionGate`, admin BFF Keycloak routes with Go-native admin session auth. Update IAM UI to remove keycloakSubject display.

3. **M13c: Mobile Auth Migration** — Replace Keycloak OIDC flow in Flutter app with Go-native auth (session cookie or token-based). Update `app_environment.dart`.

4. **M13d: NestJS Retirement or Auth Shim** — Either retire NestJS entirely (M15) or add a Go-auth-to-NestJS shim so NestJS controllers accept Go session tokens. Since M15 (NestJS disable) is scheduled after M13, this creates a dependency ordering issue.

### Dependency Ordering Issue

M13 (Keycloak disable) and M15 (NestJS disable) are coupled:
- NestJS depends on Keycloak for auth (37 controllers)
- Cannot disable Keycloak while NestJS is still active
- Cannot disable NestJS until all its functionality is migrated to Go

**Recommended resolution:** Reorder to M15 → M13, or split M13 into:
- M13-pre: Audit + plan (this report)
- M15: NestJS disable (removes 37 Keycloak-dependent controllers)
- M13a-d: Frontend/mobile auth migration
- M13-final: Actually disable Keycloak service

## Rollback State

- Keycloak Docker service: intact at `docker/keycloak/`
- Realm export: preserved at `docker/keycloak/realm-export.json`
- Keycloak database: NOT touched
- All env templates: preserved
- No destructive changes made during this audit

## Next Action

Update ORCHESTRATION_STATE to reflect:
- M13 audit complete
- M13 status: REVISE (active runtime dependencies remain)
- Next: Plan M13a-d sub-waves or reorder to M15-first
- OverallStatus remains RUNNING (not HUMAN_BLOCKED — this is a planning/sequencing issue, not an external blocker)