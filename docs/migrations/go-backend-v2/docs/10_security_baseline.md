# 10 — Security Baseline (Rebaselined)

## Authentication

- Argon2id password hashing with benchmarked parameters on Oracle A1.
- Cryptographically random opaque sessions (≥256 bits).
- Store only token hash/digest in database when practical.
- Secure/HttpOnly/SameSite cookies.
- Per-app cookie prefix isolation during transition (`bjt_web_*` / `bjt_admin_*` equivalent).
- Session revocation on logout, password change, account disable.
- Password-reset single-use tokens with expiry.
- Email verification token expiry.
- Rate limits on login, register, reset, verify, OAuth callbacks.
- CSRF defense for cookie-authenticated sessions.
- Avoid account enumeration in error responses.
- Mobile PKCE validation for public clients.

## Authorization

- Server-side checks on every protected resource.
- Admin access verified in API, not only UI.
- RBAC permissions loaded from PostgreSQL (`authz.AdminRole`, `AdminPermission`, `AdminActorRole`, `AdminRolePermission`).
- Ownership checks for learner resources.
- No trust in user-supplied role claims.
- Audit log continuity for admin actions (`ops.AdminAuditLog`, `admin.AdminAuditEvent`).

## HTTP

- TLS via Caddy.
- Secure headers through Caddy/application.
- Bounded request body sizes.
- Server read/write/header timeouts.
- Explicit upload constraints (MaxBytesReader or equivalent).
- Origin/CORS policy based on actual frontend topology.
- Streaming upload handlers must prevent unbounded memory growth.

## Database

- DB not exposed publicly.
- Separate application DB credential.
- Least required privileges.
- Migrations use dedicated elevated role if possible.
- Prepared/parameterized queries (pgx/sqlc).
- Connection pool bounded.

## Redis

- Private network only.
- Auth if environment topology warrants.
- No public port.
- Used for cache/rate-limit/pub-sub/realtime/queue infrastructure.
- Not authoritative for durable identity/business state.

## Meilisearch

- Do not expose master/admin key to browsers.
- Server-side integration only.
- Retained for Japanese/typo-tolerant search.

## Media storage

- Media root must not permit path traversal.
- Normalize and validate object keys.
- Never concatenate untrusted absolute paths.
- Public media (`/srv/kotobawork/data/media/public`) and private media clearly separated.
- Caddy serves only public root via `file_server`.
- Private assets served by Go with authentication + authorization + streaming (`http.ServeContent`).
- Uploads have size/type limits enforced server-side.
- Validate actual content where appropriate, not just Content-Type header.
- Use atomic writes (temp file → validate → rename).
- Never expose arbitrary filesystem browsing.
- Clean partial/temp files after error.

## Secrets

- No secret in Git.
- Provide `.env.example` with names only.
- Production secret files: permissions restricted, backed up securely, rotated after exposure.

## Logs

Redact:
```text
Authorization
Cookie
Set-Cookie
password
token
secret
reset code
OAuth code
```

Include: timestamp, severity, request ID, route, duration, status, safe user identifier, error code.

## SSH/host

- Public-key SSH.
- Password login disabled.
- Root login disabled.
- Host firewall.
- Only required public ports.
- Unattended security updates if operationally acceptable.
- Docker daemon socket protected.

## Supply chain

- Pin important image versions.
- Avoid `latest` in production.
- Scan dependencies/images when tooling exists.
- Verify ARM64 image provenance.

## Caddy security controls

Current Keycloak admin-IP restriction on `auth.__DOMAIN__/admin*` is evidence of a security control.
After Keycloak removal:
- Document what threat/control it currently serves.
- Determine whether an equivalent privileged endpoint exists in the new architecture.
- Preserve or formally retire the control based on the new architecture.
Do not blindly reproduce IP restrictions without understanding their purpose.

## WebSocket/realtime security

- Authenticate connections before accepting messages.
- Validate origin where applicable.
- Rate limit connection establishment.
- Apply same authorization rules as HTTP endpoints.
- See `docs/17_realtime_migration.md`.

## Billing webhook security

- Preserve exact signature verification semantics.
- Idempotent processing.
- Do not generalize or simplify payment security.