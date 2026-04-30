# Keycloak (OIDC)

## Docker (local full stack)

See `docker/keycloak/README.md`: `docker compose` with realm import, client `nihongo-web`, realm roles, and test user `testuser`.

## Overview

- Learner (`apps/web`) and admin (`apps/admin`) use **Authorization Code + PKCE** against the realm authorization server.
- Token exchange runs only on the Next.js server; **refresh** and **access** tokens are stored in **httpOnly** cookies.
- The API (`apps/api`) validates **access** JWTs via **JWKS**, checks **iss** / **aud**, and maps `sub` to `profile.user_profile.keycloak_subject` (learners) and `authz.admin_actor.keycloak_subject` (admins).

## Environment

| Variable | Used by |
|----------|---------|
| `KEYCLOAK_ISSUER_URL` | API, Next.js server routes (full realm issuer URL, no trailing slash) |
| `KEYCLOAK_CLIENT_ID` / `KEYCLOAK_CLIENT_SECRET` | Next.js token exchange (confidential client per app deployment) |
| `KEYCLOAK_EXPECTED_AUDIENCE` | API JWT `aud` (comma-separated); defaults to `KEYCLOAK_CLIENT_ID` if unset |
| `WEB_PUBLIC_URL` / `ADMIN_PUBLIC_URL` | Redirect URI base for learner vs admin callbacks |
| `NEXT_PUBLIC_KEYCLOAK_ISSUER_URL` | Full issuer in browser env (or use `NEXT_PUBLIC_KEYCLOAK_URL` + `NEXT_PUBLIC_KEYCLOAK_REALM`) |
| `KEYCLOAK_JWKS_URL` | Optional; API defaults to `${KEYCLOAK_ISSUER_URL}/protocol/openid-connect/certs` |

Use **separate Keycloak clients** for learner and admin when possible (different `KEYCLOAK_CLIENT_ID` and redirect URIs: `…/api/auth/keycloak/callback` on port 3000 vs 3001).

## Keycloak client setup

1. Client type: **confidential** (or public only if you omit secret and allow PKCE-only; this repo expects secret for server-side exchange).
2. Standard flow: **Authorization Code**.
3. **Valid redirect URIs**:  
   - `https://<web-host>/api/auth/keycloak/callback`  
   - `https://<admin-host>/api/auth/keycloak/callback`
4. **Web origins** for those hosts if required by your Keycloak version.
5. Ensure access tokens include **aud** expected by the API (client ID or audience mapper to a dedicated API audience).

## Admin access

1. Create or link a user in Keycloak.
2. Assign realm roles used for internal RBAC sync (see `KeycloakUserService.syncAdminRealmRoles`).
3. Set `authz.admin_actor.keycloak_subject` to that user’s Keycloak `sub` and grant permissions via `admin_role` as before.

## Logout

Logout uses OpenID Connect **end session** with `id_token_hint` when available and `post_logout_redirect_uri` back to `/{locale}/login`.

## Admin REST API (user provisioning)

Server-side user creation, sync, and “execute actions” email use a **separate** confidential client and `KEYCLOAK_USER_ADMIN_*` variables. See **`docs/auth/keycloak-admin.md`** for operators (roles, health checks, troubleshooting).
