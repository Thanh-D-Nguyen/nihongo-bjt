# NihonGo BJT — Mobile Auth Retest Checklist

Targeted retest for the 2026 mobile **auth rebuild** pass (login redesign +
native register + Google-only federated sign-in). Those changes are **code +
automated tests only** (`flutter analyze` clean, 243 tests pass). They are
**ready for emulator/device retest**, not visually confirmed. Run this on an
emulator (or physical device) to confirm before sign-off.

Companion docs: `MOBILE_AUTH_PRODUCTION_AUDIT.md`, `MOBILE_AUTH_GAP_REPORT.md`,
`MOBILE_KNOWN_LIMITATIONS.md`, `MOBILE_MANUAL_QA_CHECKLIST.md`.

> Do **not** mark a step passed unless you actually observed the behavior on the
> running app. Check each visual step in **light and dark**, locale **VI and
> JA**, at narrow width (~360 dp) and a normal phone width.

## Setup

- [ ] `cd apps/mobile && flutter run -d <emulator-or-device-id>` launches the
      app and lands on **Login** (unauthenticated).
- [ ] Confirm the dev Keycloak issuer is reachable (`KEYCLOAK_ISSUER`).
- [ ] To test Google end-to-end, the realm must have a Google IdP alias
      `google` (see `MOBILE_AUTH_GAP_REPORT.md` §2). If not configured, expect
      the localized "Google sign-in unavailable" error — that is correct.

## Login

1. [ ] **Layout sanity.** No horizontal overflow at 360 dp; brand wordmark +
       VI/JA locale switcher visible; password field + show/hide toggle present.
2. [ ] **Empty submit shows validation.** Tapping Sign in with empty fields
       shows "email/username required" + "password required" inline (no crash).
3. [ ] **Password visibility toggle.** Eye icon reveals/hides the password.
4. [ ] **Wrong credentials.** Bad password shows a localized error banner and
       stays on Login (no token, no crash).
5. [ ] **Valid login.** Correct credentials → returns to Home, no profile flash,
       no auth loop, no hosted-Keycloak browser opening.
6. [ ] **No removed controls.** Confirm there is **no** "secure browser" button,
       **no** "forgot password", and **no** Facebook/Apple/LINE buttons.
7. [ ] **Keyboard safety.** With the keyboard open, the form scrolls; the
       primary button is reachable; nothing is clipped.

## Google (federated via Keycloak)

8. [ ] **Single Google button present** (only when `ENABLE_GOOGLE_SIGN_IN` is
       true). Tapping it opens the system browser at Keycloak → Google.
9. [ ] **Successful Google sign-in** (if IdP configured) → returns to Home with
       a valid session.
10. [ ] **Unavailable IdP** → localized "Google sign-in unavailable" error,
        stays on Login (no crash, no fake success).
11. [ ] **Disabled flag.** Built with `--dart-define=ENABLE_GOOGLE_SIGN_IN=false`
        → the Google button is absent; account login still works.

## Register

12. [ ] **Navigate to Register.** "No account? Register" link opens the **native**
        register screen (NOT a hosted Keycloak page).
13. [ ] **Validation.** Empty submit → required errors on all four fields.
        Malformed email → email-invalid; password < 8 → too-short; mismatched
        confirm → mismatch error.
14. [ ] **Password visibility toggle** works on the register screen too.
15. [ ] **Unavailable backend (expected today).** Submitting a valid form while
        `POST /auth/register` is not deployed → honest "registration unavailable"
        banner; the user **stays** on Register (no fake success, no navigation).
16. [ ] **Success path (once backend exists).** Valid submit → returns to Login
        with a green success banner; **no** silent auto-login (endpoint mints no
        tokens). Then logging in with the new credentials works.
17. [ ] **Email already registered (once backend exists).** Duplicate email →
        inline "email already registered".
18. [ ] **Back to Login link** on the register screen returns to Login.

## Routing / session

19. [ ] **Deep link while unauthenticated** to a protected route → redirected to
        Login; `/register` is reachable while unauthenticated.
20. [ ] **Authenticated user cannot see Login/Register** (redirected to Home).
21. [ ] **Logout.** Settings → sign out shows the signing-out state, lands on
        Login, and the back button does not re-enter the authenticated app.

## Build

22. [ ] `flutter build apk --debug` succeeds on a complete Android SDK (could not
        be run on the Windows host used for this pass — validate here).

## Not covered by this pass (still open / out of scope)

- [ ] `POST /auth/register` backend endpoint (documented in
      `MOBILE_AUTH_GAP_REPORT.md`); register stays "unavailable" until deployed.
- [ ] Keycloak Google IdP realm config (required for Google end-to-end).
- [ ] Forgot-password (intentionally removed from UI; needs a backend endpoint).
- [ ] Physical-device QA + screenshots — still required for final sign-off.
