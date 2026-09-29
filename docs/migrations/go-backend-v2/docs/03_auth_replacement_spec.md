# 03 — Replace Keycloak with First-Party Go Auth (Rebaselined)

## Design goal

Replace Keycloak only to the extent required by KotobaWork.

Do not rebuild a general-purpose IAM platform.

## Scope

Keycloak removal scope MUST include:

- learner Web (`apps/web`)
- Admin (`apps/admin`)
- Flutter/mobile (`nihongo-mobile` Keycloak client, PKCE public client)
- NestJS/Go backend API
- realtime authentication (Socket.IO → WebSocket)
- Google OAuth (if active in production)
- role/permission mapping
- existing Keycloak subject mappings (`UserProfile.keycloakSubject`, `AdminActor.keycloakSubject`)

Keycloak cannot be disabled until ALL active clients have migrated.

See `docs/15_mobile_auth_migration.md`.

## Recommended browser auth

Use server-side opaque sessions.

### Session cookie

Recommended properties:

```text
HttpOnly = true
Secure = true in production
SameSite = Lax by default
Path = /
```

Cookie name should be product-specific and should not disclose implementation details.

Maintain per-app cookie prefix isolation equivalent to current `bjt_web_*` / `bjt_admin_*` separation during transition.

### Session token

Generate at least 256 bits of cryptographically secure randomness.

Store only a cryptographic hash/digest of the token in the database when practical so DB disclosure does not immediately expose live session credentials.

Example logical fields:

```text
id
user_id
token_hash
created_at
expires_at
last_seen_at
ip metadata (optional, privacy-aware)
user_agent metadata (optional)
revoked_at
rotation_parent_id (optional)
```

Do not bind sessions so tightly to IP/user-agent that legitimate mobile/network changes constantly invalidate users.

## Password hashing

Use Argon2id through a vetted library.

Store:

```text
algorithm/version
memory parameter
iterations
parallelism
salt
hash
```

Use encoded self-describing format where appropriate.

Parameters must be benchmarked on Oracle A1.

Goal:

- expensive enough to resist offline guessing;
- cheap enough to avoid trivial login DoS.

Never use SHA-256/MD5/bcrypt for new password credentials.

## Legacy credentials and identity reset (decision 2026-09-29)

`LEGACY_CREDENTIAL_MIGRATION = NOT_REQUIRED` and `IDENTITY_RESET_APPROVED = TRUE`.

The user confirmed there is no meaningful production user population and approved discarding legacy Keycloak users, credentials, sessions, and disposable application account data. Create fresh application-owned user IDs and Go Argon2id credentials. Do not implement a Keycloak password verifier, re-auth migration, or compatibility reset flow. Production Keycloak credential metadata is no longer a prerequisite for M3.

The reset approval is limited to identity/account-scoped data. Preserve authored BJT questions, vocabulary, curriculum, exercises, media/audio/images, search source content, product configuration, and non-user reference data. Before any destructive identity cleanup, map foreign-key dependencies, make and test a restorable backup, retain Keycloak configuration/export where safe, record affected row counts, and independently review an exact deletion manifest. Keep old identity data until fresh Go auth and client cutovers are verified; retain GCP rollback and backup artifacts through the stability window.

## CSRF

If using cookie-authenticated sessions, protect unsafe methods.

Typical pattern:

- SameSite cookie;
- Origin/Referer validation where reliable;
- synchronizer token or double-submit strategy;
- server-side session binding if appropriate.

Do not assume SameSite alone is sufficient for every flow.

## Session lifecycle

Required behaviors:

- login creates new session;
- successful password change revokes other sessions, unless product rules differ;
- reset password revokes previous sessions;
- logout revokes current session;
- admin account disable revokes active sessions;
- session rotation after privilege-sensitive events;
- configurable idle and absolute expiry.

## Roles and authorization

Current RBAC model (from Prisma schema):

```text
authz.AdminRole        → code, name, status
authz.AdminPermission  → code
authz.AdminActorRole   → actor ↔ role
authz.AdminRolePermission → role ↔ permission
authz.AdminActor       → keycloakSubject, email, status
ops.AdminAuditLog      → actor audit trail
admin.AdminAuditEvent  → admin action audit
```

Build a migration matrix:

```text
role / permission
source today (Keycloak realm role + AdminActor link)
which routes/actions require it
new representation (Go RBAC loaded from PostgreSQL)
tests
```

Prefer explicit permission checks for high-value admin actions.

Do not trust user-supplied role claims.

## OAuth/social login

Google OAuth exists in the codebase (`google-oauth.service.ts`, `google-oauth.controller.ts`) with feature-gate tests.

M0/M4 must determine whether Google OAuth is active in production.

If active:
- migrate to Go using standard OAuth2/OIDC libraries;
- validate `state`;
- use PKCE where applicable;
- validate issuer/audience/nonce as required;
- map provider identity to internal user record.

If inactive/feature-gated:
- document explicit retirement decision.

Do not remove a provider silently.

## Email flows

Preserve:

- verification;
- reset;
- expiry;
- single-use token behavior;
- anti-enumeration behavior.

Responses should avoid leaking whether an email exists where appropriate.

## Rate limits

At minimum:

```text
login
register
password reset request
password reset submit
email verification resend
OAuth callback abuse paths
```

Redis may support distributed counters even on a single host, but rate-limit design must remain functional after restart as required.

## Mobile client

The Flutter mobile app uses `nihongo-mobile` Keycloak client (public client, PKCE, custom redirect URI `com.nihongobjt.app://oauth2redirect`).

Mobile auth migration must preserve PKCE/public-client security semantics.

Keycloak retirement gate requires:
- mobile migrated successfully, OR
- explicit evidence that mobile is no longer an active supported client.

See `docs/15_mobile_auth_migration.md`.

## Realtime auth

Current Socket.IO gateways presumably validate Keycloak tokens.

Go WebSocket replacement must implement equivalent auth before accepting connections.

See `docs/17_realtime_migration.md`.

## Keycloak retirement gate

Keycloak may be removed only when:

- all active web clients use Go auth;
- all active admin clients use Go auth;
- all active mobile clients use Go auth (or explicitly retired);
- no API validates Keycloak tokens;
- no websocket depends on Keycloak tokens;
- account lifecycle works;
- fresh Go credentials and account lifecycle are validated; identity reset is backed up and scoped to account data;
- role behavior is proven;
- rollback window is complete.
