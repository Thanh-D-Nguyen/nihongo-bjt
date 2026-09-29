# M4 Google OAuth Retirement Decision

## Status: RETIRE (Do Not Migrate)

## Background
The NestJS backend implements Google OAuth via `apps/api/src/auth/google-oauth.controller.ts` and `apps/api/src/auth/auth.service.ts`. Investigation reveals:

1. **Feature-gated**: Google OAuth is gated behind the `social_growth` runtime feature flag (`RuntimeFeatureGateService.requireEnabled("social_growth")`).
2. **Identity linking only**: No password credentials are created for Google users. The flow creates/links an `identityProviderAccount` row and issues a one-time `linkCode` for the web app to exchange.
3. **Low usage**: The application has no meaningful production user population and is used personally.

## Decision Rationale
- Complexity of OAuth provider management (token refresh, state signing, callback handling) outweighs benefit for a personal app.
- Email/password registration with Argon2id hashing provides sufficient authentication for current needs.
- Social login can be re-added later if user demand emerges, using the same identity-linking pattern already proven in NestJS.

## What Is NOT Migrated
- `GET /api/auth/google/start` — OAuth2 redirect initiation
- `GET /api/auth/google/callback` — code exchange and identity linking
- `POST /api/auth/link/exchange` — one-time code exchange
- `GET /api/auth/identities` — linked identity listing
- `DELETE /api/auth/identities/:id` — identity unlinking
- All `OAuthStateUtil`, `GoogleOAuthService`, and related infrastructure

## References
- `apps/api/src/auth/google-oauth.controller.ts`
- `apps/api/src/auth/google-oauth.service.ts`
- `apps/api/src/auth/auth.service.ts` (upsertUserFromGoogle, createLinkCode)
- `apps/api/src/auth/oauth-state.util.ts`

## Date: 2026-09-29