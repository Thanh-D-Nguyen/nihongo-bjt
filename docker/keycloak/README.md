# Keycloak (local Docker)

## Start

```bash
cd docker/keycloak
docker compose up -d
```

Open the admin console at [http://localhost:8080](http://localhost:8080) — bootstrap user **`admin` / `admin`**.

## Realm import

- Realm **`nihongo-bjt`** is imported from `realm-export.json` on first startup (mounted as `nihongo-bjt-realm.json`, which matches Keycloak 26 directory import naming).
- Data persists in the `keycloak_data` volume. To re-import from scratch:

  ```bash
  docker compose down -v
  docker compose up -d
  ```

## Dev clients: `nihongo-web` and `nihongo-admin`

- Learner client: `nihongo-web`, redirect/web origin `http://localhost:3000`, secret from your local env.
- Admin client: `nihongo-admin`, redirect/web origin `http://localhost:3001`, dev secret `nihongo-admin-dev-secret`.
- Both are confidential OpenID Connect clients with standard flow, password grant for local dev, PKCE S256, and an audience mapper for their own client id.

## Test user

| Field    | Value        |
|----------|--------------|
| Username | `testuser`   |
| Email    | `test@test.com` |
| Password | `123456`     |
| Realm role | `user`   |

## App environment

Copy the example env files into your apps (or merge into existing `.env`):

- `env.web.local.example` → `apps/web/.env.local`
- `env.admin.local.example` → `apps/admin/.env.local`
- `env.api.example` → merge into the API process env (e.g. repo `.env` or `apps/api` loader)

Set `WEB_KEYCLOAK_*` for learner and `ADMIN_KEYCLOAK_*` for admin. The API should accept both audiences:
`KEYCLOAK_EXPECTED_AUDIENCE=nihongo-web,nihongo-admin`.

`NEXT_PUBLIC_*` variables can use either **`NEXT_PUBLIC_KEYCLOAK_ISSUER_URL`** or **`NEXT_PUBLIC_KEYCLOAK_URL` + `NEXT_PUBLIC_KEYCLOAK_REALM`** (see examples).
