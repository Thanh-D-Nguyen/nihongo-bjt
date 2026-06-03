# Mobile Auth Production Audit

Status: living document. Scope: `apps/mobile` authentication (login, register,
Google, session, routing). Companion: `MOBILE_AUTH_GAP_REPORT.md`.

## 1. Current architecture (as found)

Identity provider is **Keycloak** (realm `nihongo-bjt`). There is no separate
"app password" store — every credential check and token mint goes through
Keycloak. The mobile app talks to Keycloak directly using the **public** client
`nihongo-mobile` (PKCE, no client secret on device).

Relevant source:

- [apps/mobile/lib/features/auth/data/keycloak_auth_repository.dart](apps/mobile/lib/features/auth/data/keycloak_auth_repository.dart)
- [apps/mobile/lib/features/auth/domain/auth_repository.dart](apps/mobile/lib/features/auth/domain/auth_repository.dart)
- [apps/mobile/lib/features/auth/presentation/auth_controller.dart](apps/mobile/lib/features/auth/presentation/auth_controller.dart)
- [apps/mobile/lib/features/auth/presentation/login_page.dart](apps/mobile/lib/features/auth/presentation/login_page.dart)
- [apps/mobile/lib/core/config/app_environment.dart](apps/mobile/lib/core/config/app_environment.dart)

### Token / session handling

- Tokens persisted via `SecureAuthTokenStore` (platform secure storage). No
  password is ever stored — only access/refresh/id tokens + expiry.
- `AuthController` restores the session on startup, refreshes near expiry, and
  exposes `currentAccessToken()` for API calls. Refresh failures clear the
  session (no stale-session flash). This is production-correct.

## 2. Login flow (current)

| Path | Mechanism | Native? | Verdict |
| --- | --- | --- | --- |
| Email/username + password | Keycloak **Resource Owner Password** grant (`grant_type=password`) to `${issuer}/protocol/openid-connect/token` with public client | ✅ fully native form | Keep |
| "Secure browser" button | AppAuth Authorization Code + PKCE in system browser | ⚠️ opens hosted Keycloak | Remove from primary UI |
| Forgot password | Reuses the browser PKCE sign-in (`_startBrowserSignIn`) — **mislabelled**: it does not start a reset flow | ❌ misleading | Remove until a real reset exists |

The password grant returns the same token shape as the browser flow and is the
correct native login path. It is kept and hardened.

## 3. Register flow (current)

- The login screen's "Create account" button calls `signIn(flow: register)`,
  which opens **hosted Keycloak** in the browser with `kc_action=register`.
- This is the raw Keycloak UI the brief explicitly rejects.
- The realm export has `"registrationAllowed": false`
  ([docker/keycloak/realm-export.json](docker/keycloak/realm-export.json)), so
  hosted self-registration is also disabled by config.

There is **no native register screen** and **no mobile-safe register API**.

## 4. Google login (current)

- Implemented as `signIn(idpHint: 'google')` → AppAuth browser PKCE with
  `kc_idp_hint=google`. This federates to Google **through Keycloak**.
- This is a legitimate, secure mobile pattern (no client secret on device, no
  native Google SDK, no SHA fingerprint required because the OAuth happens in a
  web context owned by Keycloak). It is **not** a fake button.
- It only works if the Keycloak realm has a Google identity provider with alias
  `google`. See gap report for the exact config.
- The current screen also shows Facebook / Apple / LINE buttons. The brief asks
  for **Google only**, so the others are removed.

## 5. Web auth behaviour (reference for parity)

Web is a Next.js BFF: secrets live on the server, browser gets cookies.

- Login: `POST /api/auth/keycloak/password-login` → password grant via the
  **confidential** web client → sets cookies.
- Register: `POST /api/auth/keycloak/register` → **Keycloak Admin REST API**
  (client credentials) creates the user with a password credential, assigns the
  `user` realm role, then auto-logs-in via password grant. Returns `503`
  `registration_unavailable` when the admin client is not configured.
- Forgot password: `POST /api/auth/keycloak/forgot-password` → Admin API
  `execute-actions-email` (`UPDATE_PASSWORD`). Always returns `ok` to prevent
  email enumeration.
- Google: server adds `kc_idp_hint` from `NEXT_PUBLIC_AUTH_GOOGLE_IDP_HINT`.

Key takeaway: **register and forgot-password require server-side Keycloak Admin
credentials** that must never ship in the mobile binary. Mobile therefore needs
a backend endpoint, not a direct Keycloak Admin call.

## 6. Backend (NestJS) auth surface

- [apps/api/src/auth/auth.controller.ts](apps/api/src/auth/auth.controller.ts)
  exposes only authenticated profile/identity endpoints (`/auth/me`,
  `/auth/profile`, `/auth/identities`, `/auth/link/exchange`). **No public
  `/auth/register`, no password-login, no forgot-password.**
- [apps/api/src/keycloak/keycloak-realm-admin.service.ts](apps/api/src/keycloak/keycloak-realm-admin.service.ts)
  already implements server-side Keycloak Admin calls (`createUser`,
  `findUserIdByEmail`, `sendExecuteActionsEmail`) gated by
  `KEYCLOAK_USER_ADMIN_CLIENT_ID/SECRET`. `createUser` does **not** set a
  password today (it relies on `execute-actions-email`).

So the building blocks for a backend register endpoint exist, but the endpoint
itself is not wired and is out of scope for a mobile-only change (it changes the
production API contract and needs its own DTO/RBAC/rate-limit/OpenAPI/tests +
backend verification run). It is documented as a required backend change.

## 7. What can be implemented now (mobile only, no backend change)

1. **Login** — redesign to a premium native screen. Keep the password grant.
   Remove the browser button, the misleading forgot-password, and the extra
   social buttons. Keep **Google** (federated via Keycloak). Theme-aware
   (light/dark), VI/JA localized, 320–390 dp safe, keyboard-safe.
2. **Google** — keep the federated browser flow, surfaced as a single primary
   "Continue with Google" button with a real Google glyph and an error state
   when the IdP is unavailable/misconfigured.
3. **Register** — build a native register screen + form/state machine + a
   `RegisterRepository` that POSTs to `${apiBaseUrl}/auth/register`. Because the
   endpoint is not yet implemented, the screen surfaces a **documented
   "registration unavailable"** state on `404/503/unreachable` (no fake
   success). When the backend endpoint is added, mobile works with no further
   change.
4. **Routing/session** — already solid; verify no login flash, no auth loop, no
   accidental Keycloak redirect from normal login/register.

## 8. What requires backend / infra change

See `MOBILE_AUTH_GAP_REPORT.md` for the precise list (register endpoint,
Keycloak Google IdP, forgot-password endpoint, env/config).

## 9. Security posture

- No client secret on device (public PKCE client). ✅
- Passwords passed only to the grant call, never persisted. ✅
- No tokens or credentials logged; errors mapped to stable, localized codes. ✅
- No insecure connections except an explicit local `http://` issuer in dev. ✅
- No auth bypass introduced. Register stays honest (no faked success). ✅

## 10. Final mobile auth decision

- Login: **native password grant**, redesigned, hardened. Keep.
- Google: **federated browser flow via Keycloak**, single Google button. Keep.
- Register: **native screen** wired to a future `${apiBaseUrl}/auth/register`;
  honest "unavailable" state until the backend endpoint + Keycloak admin config
  exist.
- Forgot password: **removed** from the UI until a real backend endpoint exists
  (no fake button).
- Hosted Keycloak redirect: **removed** from normal login/register UX; the
  Keycloak backend integration itself is unchanged.

## 11. Implementation status (2026 auth rebuild pass)

Status: **implemented on mobile, ready for emulator/device retest** (code +
automated tests only; not yet visually confirmed on a running build).

| Item | State | Evidence |
| --- | --- | --- |
| Native login (password grant) | ✅ done | [login_page.dart](apps/mobile/lib/features/auth/presentation/login_page.dart) |
| Browser button removed | ✅ done | no `_startBrowserSignIn` entry point in login UI |
| Forgot-password removed | ✅ done | key/button gone from login UI + arb |
| Facebook/Apple/LINE removed | ✅ done | only `GoogleSignInButton` remains |
| Single "Continue with Google" (federated) | ✅ done, gated on `googleSignInEnabled` | [auth_widgets.dart](apps/mobile/lib/features/auth/presentation/widgets/auth_widgets.dart) |
| Native register screen + form/state machine | ✅ done | [register_page.dart](apps/mobile/lib/features/auth/presentation/register_page.dart), [register_controller.dart](apps/mobile/lib/features/auth/presentation/register_controller.dart) |
| Register repository → `POST /auth/register` | ✅ done | [api_register_repository.dart](apps/mobile/lib/features/auth/data/api_register_repository.dart) |
| Honest "registration unavailable" state | ✅ done (404/503/network → `RegisterFailureCode.unavailable`/`network`) | [register_repository.dart](apps/mobile/lib/features/auth/domain/register_repository.dart) |
| Register success → Login + success banner (no auto-login) | ✅ done | router `registered=1` query + `AuthBanner.success` |
| Routing: `/register` exempt from auth redirect | ✅ done | [auth_redirect.dart](apps/mobile/lib/core/auth/auth_redirect.dart) |
| Google config flag (`ENABLE_GOOGLE_SIGN_IN`, `OAUTH_GOOGLE_IDP_HINT`) | ✅ done | [app_environment.dart](apps/mobile/lib/core/config/app_environment.dart) |

### Verification (this pass)

- `flutter analyze lib test` → **No issues found.**
- `flutter test` → **all 243 tests pass.**
- New/updated tests:
  - [test/features/auth/login_page_test.dart](apps/mobile/test/features/auth/login_page_test.dart) — narrow-width/dark/JA layout + behavior (empty-form validation, password toggle, Google button present by default, Google hidden when `googleSignInEnabled=false`, registered-success banner).
  - [test/features/auth/register_controller_test.dart](apps/mobile/test/features/auth/register_controller_test.dart) — idle/success/failure-code/unavailable, never fakes success.
  - [test/features/auth/register_page_test.dart](apps/mobile/test/features/auth/register_page_test.dart) — layout (320–390 dp, dark, JA), validation (required/email/short-password/mismatch), honest "unavailable" banner with no navigation.
  - [test/core/auth/auth_redirect_test.dart](apps/mobile/test/core/auth/auth_redirect_test.dart) — `/register` exemption for unauthenticated, redirect away for authenticated.

### Still blocked (backend/infra, out of scope here)

- `POST /auth/register` endpoint does not exist yet → register surfaces the
  documented "unavailable" state. Contract in `MOBILE_AUTH_GAP_REPORT.md`.
- Keycloak realm needs a Google IdP with alias `google` for the Google button to
  succeed end-to-end.

