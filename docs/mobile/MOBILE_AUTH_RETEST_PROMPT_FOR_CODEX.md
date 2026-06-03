# Retest Prompt for Codex — Mobile Auth Rebuild (Login + Register + Google)

Paste this into Codex (or another agent that can run the Flutter app on an
emulator/device). It performs a **runtime verification only** pass. It must not
change code unless explicitly asked.

---

## Role

You are a mobile QA engineer verifying a completed auth rebuild in
`apps/mobile` of the NihonGo BJT project. The work is code-complete and passes
`flutter analyze` (clean) and `flutter test` (243 tests). Your job is to run the
app and confirm the behavior on a real running build, in **light and dark**, in
locales **VI and JA**, at **~360 dp** and a normal phone width.

## Hard rules

- **Do NOT modify application code** unless I explicitly ask you to. If you find
  a bug, report it with exact file/line and reproduction steps — do not fix it.
- **Never fake or assume a result.** Only mark a step passed if you actually
  observed it on the running app. If you cannot run something (e.g. Google IdP
  not configured, backend endpoint missing), say so explicitly.
- Do not commit, push, or change branches.
- Capture a screenshot for each major screen/state (login, login error,
  register, register validation, register "unavailable", post-login Home,
  logout→login) in both light and dark.

## Setup

1. `cd apps/mobile`
2. `flutter pub get`
3. `flutter run -d <emulator-or-device-id>`
4. Confirm the app launches on **Login** (unauthenticated) and the dev Keycloak
   issuer is reachable.

## Test matrix (follow `docs/mobile/MOBILE_AUTH_RETEST_CHECKLIST.md`)

Execute every step in `MOBILE_AUTH_RETEST_CHECKLIST.md`. In particular verify:

- **Login**: empty-form validation, password show/hide, wrong credentials error
  (stays on Login), valid login → Home (no flash, no auth loop, no hosted
  Keycloak), and that the browser button / forgot-password / Facebook / Apple /
  LINE are all **absent**.
- **Google**: single "Continue with Google" button; opens Keycloak→Google in the
  system browser; success → Home; unavailable IdP → localized error, stays on
  Login; with `--dart-define=ENABLE_GOOGLE_SIGN_IN=false` the button is gone.
- **Register**: native screen (NOT hosted Keycloak); all validation cases
  (required, email format, password < 8, confirm mismatch); password toggle;
  the **honest "registration unavailable"** state when `POST /auth/register` is
  not deployed (stays on Register, no fake success); and — only if the backend
  endpoint is later deployed — success returns to Login with a success banner
  and **no** auto-login.
- **Routing/session**: protected deep link → Login while unauthenticated;
  `/register` reachable while unauthenticated; authenticated user cannot reach
  Login/Register; logout shows signing-out state → Login, back button does not
  re-enter the app.
- **Build**: `flutter build apk --debug` succeeds on a complete Android SDK.

## Known limitations (do not log as new bugs)

- `POST /auth/register` does not exist yet → register "unavailable" is the
  expected behavior (contract in `docs/mobile/MOBILE_AUTH_GAP_REPORT.md`).
- Google requires a Keycloak realm Google IdP (alias `google`) to work
  end-to-end; without it the "unavailable" error is expected.
- Forgot-password is intentionally removed (no fake button).

## Deliverable

Report, per checklist step: **PASS / FAIL / BLOCKED (reason)**, with the
screenshot reference and — for any FAIL — exact file/line + steps to reproduce.
Summarize at the top: overall verdict and whether the auth rebuild is
sign-off-ready for production pending the documented backend work.
