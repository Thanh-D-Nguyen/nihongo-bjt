# Keycloak integration (web, admin, API)

## Environment variables

Use separate OIDC clients for learner and admin. The API validates both access-token audiences.

| Variable | Role |
|----------|------|
| `KEYCLOAK_ISSUER_URL` | API: OIDC issuer (`/realms/{realm}`) |
| `KEYCLOAK_JWKS_URL` | Optional JWKS override |
| `KEYCLOAK_EXPECTED_AUDIENCE` | API JWT `aud`, e.g. `nihongo-web,nihongo-admin` |
| `WEB_KEYCLOAK_CLIENT_ID` / `WEB_KEYCLOAK_CLIENT_SECRET` | Learner Next.js token exchange |
| `ADMIN_KEYCLOAK_CLIENT_ID` / `ADMIN_KEYCLOAK_CLIENT_SECRET` | Admin Next.js token exchange |
| `KEYCLOAK_ADMIN_REALM_ROLES` | Comma-separated realm or resource role names that may use the **admin** app shell; default `admin` |
| `KEYCLOAK_ADMIN_INTERNAL_ROLE_ALIASES` | Optional alias map from Keycloak roles to internal `authz.admin_role.code`; default `admin:admin.super,superadmin:admin.super` |
| `NEXT_PUBLIC_WEB_KEYCLOAK_*` | Learner browser OIDC metadata |
| `NEXT_PUBLIC_ADMIN_KEYCLOAK_*` | Admin browser OIDC metadata |

See root `.env.example` for placeholders.

## Browser flow

1. User opens `/[locale]/login` (web) or admin login; clicks through to `/api/auth/keycloak/authorize`.
2. Keycloak authenticates the user; redirect returns to **`/auth/callback`** with `code` (PKCE).
3. Next.js exchanges the code server-side, sets **httpOnly** session cookies, then redirects to the app.
4. Authenticated API calls from the browser use **`/api/auth/keycloak/session`** to read a short-lived access token and send `Authorization: Bearer …` to the API (`learnerApiFetch` / `adminApiFetch`).
5. Logout uses **`/auth/logout`**, which clears cookies and redirects to Keycloak logout.

## Admin gate

After OIDC session exists, the admin app calls **`GET /api/admin/session`** (with Bearer). **403** means the user lacks a configured Keycloak admin role or has no linked `admin_actor.keycloak_subject` — the UI sends them to **`/[locale]/access-denied`**. Internal RBAC still applies on each admin API route.

## Manual Keycloak configuration

- **Valid redirect URIs** for the public client must include the Next.js callback URLs, e.g. `http://localhost:3000/auth/callback` (learner) and `http://localhost:3001/auth/callback` (admin), plus production URLs.
- Assign at least one role listed in `KEYCLOAK_ADMIN_REALM_ROLES` to users who should pass the admin portal gate.
- Link each admin user to a row in `authz.admin_actor` with `keycloak_subject` equal to the Keycloak user `sub`.
- Ensure mapped internal roles grant the expected admin permissions. By default, Keycloak role `admin` syncs to internal `admin.super`, so local admin accounts get `assessment.manage`, `battle.manage`, `iam.manage`, and other production-admin permissions after the next authenticated API request.

## Local HTTP (Docker Keycloak)

For the bundled `docker/keycloak` stack, Keycloak listens on **http://localhost:8080** without TLS. The imported realm uses **`sslRequired: none`** so HTTP is allowed for all clients (not only “localhost” guesses). Docker `start-dev` is started with **`--hostname=http://localhost:8080`** so discovery documents and redirects stay on **http**, not **https**.

The Docker Compose stack runs a **`keycloak-configure-http`** one-shot container after Keycloak becomes healthy; it uses `kcadm.sh` to set **`sslRequired=NONE`** on realm **`master`** (Admin Console) and **`nihongo-bjt`**. Directory import does not alter `master`, so without this step you can still see **HTTPS required** when opening `/admin` over HTTP (especially from a non-`localhost` hostname/IP).

- If login breaks after a realm change: either re-import (`docker compose down -v` in `docker/keycloak`) or set **Require SSL = None** in the Keycloak Admin UI for realm **`master`** and **`nihongo-bjt`** (imports do not overwrite an existing realm).
- Keep app env URLs as **`http://localhost:8080/...`**; using `https://` without a real certificate or reverse proxy will fail.

## Legacy dev (Keycloak off)

If `NEXT_PUBLIC_KEYCLOAK_ISSUER_URL` (and URL+realm fallback) are unset, the UIs skip OIDC and the API may accept legacy dev headers where implemented (e.g. `x-admin-actor-id`). This is for local development only.
