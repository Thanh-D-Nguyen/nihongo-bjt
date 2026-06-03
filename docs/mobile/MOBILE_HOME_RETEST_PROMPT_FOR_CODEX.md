# Prompt — Codex Mobile Home Retest

You are retesting only the Flutter mobile Home dashboard in `apps/mobile`.

## Scope

- Run on an emulator or physical device.
- Login with the local test account at runtime only.
- Do not store credentials in code, docs, screenshots, or terminal history.
- Do not modify code unless explicitly asked.
- Compare mobile Home against the web Home dashboard for functional parity and brand consistency.
- Update the relevant QA report after testing.

## Required Steps

1. Read:
   - `docs/mobile/MOBILE_HOME_WEB_PARITY_AUDIT.md`
   - `docs/mobile/MOBILE_HOME_RETEST_CHECKLIST.md`
   - `docs/mobile/MOBILE_KNOWN_LIMITATIONS.md`
   - `docs/mobile/MOBILE_MANUAL_QA_CHECKLIST.md`
2. Run:
   - `cd apps/mobile && flutter analyze`
   - `cd apps/mobile && flutter test`
3. Start local Keycloak/API if available.
4. Launch the app:
   - `cd apps/mobile && flutter run -d <device-id>`
5. Login with the local account only at runtime.
6. Test Home visually and functionally:
   - populated state
   - loading/error/empty if testable
   - light/dark mode
   - 360-390 dp phone width
   - tablet/foldable width if available
   - every Home shortcut and expected destination
   - backend/API-down behavior
7. Capture screenshots listed in `MOBILE_HOME_RETEST_CHECKLIST.md`.
8. Compare against web Home:
   - core hierarchy
   - naming/tone
   - real data boundaries
   - mobile-native layout
9. Update QA report with:
   - environment
   - login result
   - screenshots
   - pass/fail table
   - issues with severity and repro steps
   - whether runtime API verification was blocked.

## Guardrails

- Do not claim live Home data passed if local API/Keycloak were not running.
- Do not file missing web-only widgets as mobile bugs when the audit marks them omitted or not suitable for Home.
- Do not test or fix the full auth system except as needed to reach Home.
