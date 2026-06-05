---
name: bjt-mobile-auth-account
description: Implement, audit, or polish authentication and account management in the Nihongo BJT Flutter mobile app \u2014 login/register, social login, password reset, linked accounts, session/token handling, and safe logout via Keycloak/OIDC. Use when building or fixing the auth flow, account/linked-account screens, session lifecycle, or auth guards/redirects.
---

# BJT Mobile Auth & Account Skill

Use this skill when implementing, auditing, or polishing authentication and
account management. Follow the `bjt-mobile-foundation-quality-gate` baseline.
The Me hub navigation lives in `bjt-mobile-profile-me-hub`; this skill owns the
auth flow, session lifecycle, and account/credential screens.

## Goal

A reliable, secure auth experience: sign in/up (incl. social), recover access,
manage linked accounts, and sign out cleanly — with correct session handling and
no auth loops.

## Core principle

Auth is **server/OIDC-driven** (Keycloak). The client manages tokens securely,
reflects real session state, and never fakes authentication or stores plaintext
credentials.

## Hard rules

- Use the real Keycloak/OIDC auth flow. No fake login, no bypass, no local-only
  "logged in" state.
- Store tokens only in `flutter_secure_storage`; never log or expose tokens.
- Logout fully clears session, shows a clear signing-out state, redirects to
  Login cleanly, and never loops or flashes a stale profile.
- Auth guards/redirects must be correct for first-run, expired session, and
  deep links.
- Social login and linked-accounts use the real provider/account contract; show
  honest unavailable state if a provider is not configured.
- Password reset / forgot-password uses the real flow; no fake success.
- Surface auth errors gently and actionably (no raw Keycloak/AppAuth wording).
- Keep VI/JA localization in sync. Support light/dark, 360–390 dp. Add/update
  tests.

## Required audit before coding

Inspect:
- web `/login`, `/register`, `/forgot-password`, `/settings/accounts`,
  `/settings/linked-accounts` pages, their auth/account APIs and models
- mobile auth feature (login/register/controllers/repositories), keycloak/OIDC
  repository, secure storage, router redirect/guards, profile providers, l10n,
  tests

Create/update:
- `docs/mobile/AUTH_ACCOUNT_WEB_PARITY_AUDIT.md`
- `docs/mobile/AUTH_ACCOUNT_CONTRACT.md`
- `docs/mobile/AUTH_ACCOUNT_IMPLEMENTATION_PLAN.md`

## Required surfaces

1. Login (email/password + social) with correct error/loading states.
2. Register with validation and post-register routing (into onboarding).
3. Forgot/reset password flow.
4. Linked accounts / social providers management (real provider state).
5. Session lifecycle: token refresh, expiry handling, secure storage.
6. Logout / signing-out state with clean redirect.

## Required tests

- login success/failure/loading
- register validation + routing
- forgot-password flow
- linked-accounts render real provider state; honest unavailable
- expired-session redirect handled without loop
- logout clears session and redirects cleanly; no stale profile flash
- no token in logs/UI; dark mode, 360 dp, long VI/JA text

## Verification

`cd apps/mobile && flutter analyze` · `flutter test` · `git diff --check`.
Stop if red. Document live-OIDC runtime verification as blocked-with-proof if the
auth server is unreachable. Report files changed and commands + results.
