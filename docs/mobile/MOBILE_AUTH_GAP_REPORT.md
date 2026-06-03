# Mobile Auth Gap Report

Precise list of what the mobile auth experience needs from the backend / infra
to be fully functional. Companion: `MOBILE_AUTH_PRODUCTION_AUDIT.md`.

Legend: 🟢 done on mobile · 🟡 mobile-ready, blocked on config/backend · 🔴 not
started / requires backend work.

## Summary

| Capability | Mobile UI | Works end-to-end? | Blocker |
| --- | --- | --- | --- |
| Email/username + password login | 🟢 | ✅ (dev Keycloak) | none |
| Continue with Google | 🟢 | 🟡 | Keycloak realm must have a Google IdP (alias `google`) |
| Register | 🟢 | 🟡 | backend `POST /auth/register` endpoint + Keycloak admin client |
| Forgot password | — (hidden) | 🔴 | backend `POST /auth/forgot-password` endpoint |
| Logout | 🟢 | ✅ | none |

---

## 1. Register — required backend endpoint (BLOCKER)

The mobile binary must never carry Keycloak Admin credentials, so it cannot
create users directly. A backend endpoint is required. The mobile app already
calls it and handles `503`/`404`/network as a documented "unavailable" state.

### Contract the mobile client expects

```
POST {API_BASE_URL}/auth/register
Content-Type: application/json

{ "displayName": "Akira", "email": "a@b.com", "password": "••••••••" }
```

Responses the mobile client handles:

| Status | Body | Mobile behaviour |
| --- | --- | --- |
| `200/201` | `{ "ok": true }` | success → return to Login with success banner (or auto-login if backend later returns tokens) |
| `409` | `{ "error": "user_exists" }` | inline "email already registered" |
| `400` | `{ "error": "validation", "field"?: "email\|password\|displayName" }` | inline field error |
| `503` | `{ "error": "registration_unavailable" }` | "registration not enabled on this server" state |
| `404` / network | — | same "registration unavailable" state |

### Suggested backend implementation (NestJS, reuses existing code)

`apps/api/src/auth/auth.controller.ts` — add a **public** (unauthenticated)
`POST /auth/register`:

1. Validate with a zod DTO (displayName 1–64, email RFC-ish, password ≥ 8).
2. Use `KeycloakRealmAdminService` (extend `createUser` to accept a password
   credential — mirror the web lib `createRealmUser`, i.e. include
   `credentials: [{ type: "password", temporary: false, value }]`).
3. Assign the `user` realm role (mirror web `assignRealmRole`).
4. Return `503 registration_unavailable` when `isEnabled()` is false.
5. Return `409 user_exists` on Keycloak conflict.
6. Add throttling (e.g. `@nestjs/throttler`) — public endpoint.
7. Add OpenAPI decorators + audit log; no tokens in the response.

### Required env / realm config to actually enable it

```
KEYCLOAK_BASE_URL=...                      # or derived from KEYCLOAK_ISSUER_URL
KEYCLOAK_USER_ADMIN_TARGET_REALM=nihongo-bjt
KEYCLOAK_USER_ADMIN_CLIENT_ID=...          # confidential client w/ realm-admin
KEYCLOAK_USER_ADMIN_CLIENT_SECRET=...      # server-only, never in mobile build
```

Until the endpoint exists, mobile register shows the honest "unavailable" state.

---

## 2. Google login — required Keycloak config (BLOCKER for green)

Mobile Google uses the **federated browser flow via Keycloak** (AppAuth +
`kc_idp_hint=google`). No native Google SDK, **no client secret on device**, and
**no Android SHA-1/SHA-256** is required because the OAuth happens in a web
context owned by Keycloak (not the native Google Sign-In SDK).

To make the button succeed, the Keycloak realm `nihongo-bjt` must have:

1. An **Identity Provider** of type Google with **alias `google`** (the value
   passed as `kc_idp_hint`). If a different alias is used, set the mobile
   `--dart-define=OAUTH_GOOGLE_IDP_HINT=<alias>`.
2. The Google OAuth client (in Google Cloud Console) configured with the
   Keycloak broker redirect URI:
   `${KEYCLOAK_ISSUER}/broker/google/endpoint`.
3. The mobile app's custom-scheme redirect already registered on both
   platforms: `com.nihongobjt.app://oauth2redirect`
   (Android `appAuthRedirectScheme`, iOS `CFBundleURLSchemes`). ✅ already set.

If the IdP is missing, Keycloak returns an error in the browser; the mobile UI
shows a localized "Google sign-in is unavailable" error and stays on Login.

### What is NOT required (because we use the federated flow)

- ❌ `google_sign_in` Flutter package
- ❌ `google-services.json` / `GoogleService-Info.plist`
- ❌ Android SHA-1 / SHA-256 fingerprints
- ❌ A Google OAuth client ID baked into the app

If the product later wants the **native** Google one-tap experience instead, that
becomes a separate task requiring all of the above plus a Keycloak token-exchange
or direct-naked broker login; out of scope here.

---

## 3. Forgot password — required backend endpoint

Currently **hidden** (no fake button). To enable, add a public backend endpoint
mirroring the web route:

```
POST {API_BASE_URL}/auth/forgot-password   { "email": "a@b.com" }
→ always 200 { "ok": true }   (no email enumeration)
```

Backend uses `KeycloakRealmAdminService.sendExecuteActionsEmail(id,
["UPDATE_PASSWORD"], lifespan)` after `findUserIdByEmail`. Requires the same
Keycloak admin env as register, plus a configured SMTP in the realm. Once the
endpoint exists, re-enable the "Forgot password?" link on the mobile Login
screen.

---

## 4. Keycloak hosted-redirect removal

- Normal mobile **login** and **register** no longer open hosted Keycloak.
- The Keycloak backend integration (token/refresh/logout, federated Google) is
  **unchanged** — Keycloak remains the real identity provider.
- The only remaining browser hand-off is the Google federated flow, which is
  expected and standard.

---

## 5. Decision log

- Mobile will not embed Keycloak Admin credentials → register must be a backend
  endpoint. Documented above; mobile is wired and ready.
- Mobile Google stays federated-via-Keycloak (secure, no SDK/secret) rather than
  native Google Sign-In (avoids shipping client IDs / SHA management).
- No auth bypass, no faked success anywhere.
