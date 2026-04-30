# Keycloak Admin API (operator)

This document covers **server-only** use of the Keycloak **Admin REST API** to create or sync users, send required-action emails, and support the admin “Create / invite user” flow. It is separate from browser OIDC login (authorization code + PKCE).

- **Learner and admin UIs** never receive Admin API credentials.
- **PostgreSQL** never stores Keycloak user passwords or client secrets.
- The API service reads configuration from **environment variables** and logs **whether** the integration is enabled—not secret values.

## What it enables in NihonGo BJT

When configured, `KeycloakRealmAdminService` can:

- Create realm users (no local password in the app DB)
- Find an existing user by email (for sync)
- Call **execute actions email** (e.g. `VERIFY_EMAIL`, `UPDATE_PASSWORD`) when the admin flow requests it

If the Admin API is **not** configured, user creation can still create **app profiles** and invitation records; operators must complete identity setup in Keycloak manually (see *Troubleshooting*).

## Required environment variables

| Variable | Required for Admin API | Description |
|----------|------------------------|-------------|
| `KEYCLOAK_BASE_URL` | Recommended | Origin of the Keycloak server, e.g. `https://auth.example.com` (no path). If unset, the API can derive a base URL from `KEYCLOAK_ISSUER_URL` when that URL includes `/realms/{realm}`. |
| `KEYCLOAK_USER_ADMIN_TARGET_REALM` | Optional if derivable | Realm where app users live. If unset, the realm is parsed from `KEYCLOAK_ISSUER_URL` (path segment after `/realms/`). |
| `KEYCLOAK_USER_ADMIN_CLIENT_ID` | Yes | Confidential **service** client used only by the API (client credentials). |
| `KEYCLOAK_USER_ADMIN_CLIENT_SECRET` | Yes | **Server-only** secret. Never set this in the browser, Next.js `NEXT_PUBLIC_*`, or client-side code. **Never commit** real values to the repo. |
| `KEYCLOAK_ISSUER_URL` | Often already set | Full issuer for your realm. Used to derive base URL and/or realm when the variables above are omitted. |

Corresponding entries exist in `packages/config` (see `KEYCLOAK_BASE_URL`, `KEYCLOAK_USER_ADMIN_*`).

## Keycloak client setup (target realm)

Create a **confidential** client in the **same realm** as your end users (or a realm whose users you manage—must match `KEYCLOAK_USER_ADMIN_TARGET_REALM`).

1. **Client authentication**: On (confidential).
2. **Service accounts**: Enable **Service accounts roles** (client credentials grant).
3. **Standard flow**: Can stay off for this client if it is API-only; this client is **not** used for user browser login.
4. Assign **client roles** on **`realm-management`** (built-in client in that realm) to the **service account** of your admin client. Typical **minimum** roles for user create / search / email actions:

   | Client role (under `realm-management`) | Purpose |
   |----------------------------------------|---------|
   | `manage-users` | Create/update users, execute actions, etc. |
   | `view-users` | Read user representations (often required together with the above) |
   | `query-users` | Search users by email for sync flows |

   Your Keycloak version may show slightly different role names; if an operation returns **403**, add the role Keycloak’s error suggests or use **admin**-scoped roles per your org’s security policy (prefer least privilege).

5. **Email**: For `execute-actions-email` to work, the realm should have a valid **SMTP** (or use an external provider) in Realm settings → Email.

6. **Redirect URIs** for this client: Not required for the Admin API client if you only use `client_credentials`.

**Never** reuse the public web or admin “login” client ID/secret for this integration—use a dedicated service client.

## Local development

1. Start Keycloak (e.g. `docker compose` per `docker/keycloak/README.md` and `docs/ops/keycloak.md`).
2. In the **same realm** as `KEYCLOAK_ISSUER_URL`, create the confidential client and **realm-management** roles as above.
3. In the API `.env` (repo root or `apps/api` parent `.env` as used by `main.ts`), set `KEYCLOAK_BASE_URL`, `KEYCLOAK_USER_ADMIN_CLIENT_ID`, `KEYCLOAK_USER_ADMIN_CLIENT_SECRET`, and if needed `KEYCLOAK_USER_ADMIN_TARGET_REALM`.
4. Restart the API. On startup, logs include either **enabled** (with non-secret base + realm) or **disabled** with reasons (see below).
5. `GET /api/health/version` and `GET /api/health/ready` include a **`keycloak_realm_admin`** (ready) and **`keycloakRealmAdmin`** (version) field describing configuration status—**not** the secret.

## Production notes

- Store `KEYCLOAK_USER_ADMIN_CLIENT_SECRET` in a **secret manager** or sealed deployment config; rotate on compromise or policy.
- Use **dedicated** credentials per environment (dev/staging/prod).
- Lock down **network** access from the API to Keycloak (VPC, allowlists) where applicable.
- Monitor **401/403** from the token or Admin endpoints after deploys (wrong secret or missing roles).
- The Admin API is **optional** for overall API readiness: the health check reports status but does not mark the process unhealthy solely because the Admin API is off—some deployments run without automated Keycloak user provisioning.

## Observability: logs and health

- **Startup**: `KeycloakRealmAdminService` logs one line: enabled (base + realm) or disabled with `getDisabledReasons()`—no secrets, no `Authorization` header values.
- **Health**
  - `GET /api/health/version` — includes `keycloakRealmAdmin: { enabled, disabledReasons? }`.
  - `GET /api/health/ready` — includes `checks.keycloak_realm_admin` with `status: "ok"` and a short `message` (`enabled` vs `not_configured: …` reasons).

**Never** log or return `KEYCLOAK_USER_ADMIN_CLIENT_SECRET` or any access/refresh token body.

## Troubleshooting

| Symptom | Likely cause | What to do |
|--------|--------------|------------|
| Startup / health: `not_configured: …` | Missing or empty env | Set `KEYCLOAK_BASE_URL` (or a parseable `KEYCLOAK_ISSUER_URL`), `KEYCLOAK_USER_ADMIN_CLIENT_ID`, and `KEYCLOAK_USER_ADMIN_CLIENT_SECRET`. Set realm explicitly if parsing fails. |
| Log: `Keycloak token failed: 401` | Wrong client id/secret, wrong realm token endpoint, or client not confidential | Fix secret in env; confirm client has **Service accounts** enabled; confirm realm name matches `…/realms/{realm}/protocol/…`. |
| Log: `Keycloak create user: 403` or `list users: 403` | Service account missing **realm-management** roles | Add `manage-users`, `view-users`, `query-users` (or broader roles per policy). Re-check **Service account** role mappings (not just user). |
| Log: `Keycloak token failed: 400` | Malformed `KEYCLOAK_BASE_URL`, wrong path | Use origin only, no `/auth` path unless your Keycloak actually uses the legacy path. |
| `execute-actions-email` returns false / email not received | User created but email failed | Check realm **SMTP**; check user **email** present; some actions require `VERIFY_EMAIL` in required actions. Check server logs (no success body that leaks secrets). |
| Duplicate or sync errors | Data vs Keycloak mismatch | Use admin UI or Keycloak to inspect user by email; use invite-only mode until Admin API is fixed. |

## Related docs

- `docs/ops/keycloak.md` — browser OIDC, JWKS, and general environment.
- `docker/keycloak/README.md` — local realm and clients.
