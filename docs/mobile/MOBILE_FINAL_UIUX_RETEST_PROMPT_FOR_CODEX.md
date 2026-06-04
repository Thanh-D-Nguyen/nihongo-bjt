# Prompt — Codex Mobile Final UI/UX Retest

You are retesting the full Flutter mobile app UI/UX in `apps/mobile` after a
skills-driven UI/UX production polish pass. Your job is **device/emulator visual
verification** — the automated suite is already green and is not the deliverable
here.

## Scope

- Run on an emulator or physical device.
- Test every implemented screen, in light + dark, at 360 dp and 390 dp (and a
  tablet/foldable if available), in vi and ja.
- Login with the local test account **at runtime only**.
- Do not store credentials in code, docs, screenshots, or terminal history.
- Do not modify code unless explicitly asked.
- Update `MOBILE_FINAL_UIUX_RETEST_CHECKLIST.md` (or a copy) with results.

## Out of scope

- **Battle** is web-only; it is not implemented on mobile. Do not file its
  absence as a mobile bug.
- Inventing new features, fake data, or new product surfaces.
- Real-credential or live-payment testing.

## Required steps

1. Read:
   - `docs/mobile/MOBILE_FINAL_UIUX_RETEST_CHECKLIST.md`
   - `docs/mobile/MOBILE_FLUTTER_SKILLS_UIUX_PLAN.md`
   - `docs/mobile/MOBILE_SCREEN_UIUX_AUDIT_MATRIX.md`
   - `docs/mobile/MOBILE_KNOWN_LIMITATIONS.md`
   - `docs/mobile/MOBILE_DESIGN_SYSTEM.md`
2. Run the host gates:
   - `cd apps/mobile && flutter analyze`
   - `cd apps/mobile && flutter test`
   - `cd apps/mobile && flutter test integration_test` (needs a connected device)
3. Start local Keycloak/API if available.
4. Launch the app: `cd apps/mobile && flutter run -d <device-id>`.
5. Login with the local account only, at runtime.
6. Walk the checklist screen-by-screen. For each, verify:
   - populated state, plus loading/empty/error where reachable
   - light + dark mode
   - 360 dp and 390 dp widths (and tablet/foldable if available)
   - vi and ja locales
   - no `RenderFlex overflowed` banners in the debug console
   - 48 dp touch targets, safe-area, reduced-motion, large text scale
   - bottom nav never overlaps a sticky CTA
7. Capture screenshots for each area (light + dark).
8. Update the QA report / checklist with:
   - environment (device, OS, widths, themes, locales, backend state)
   - login result
   - screenshots
   - pass/fail table with severity + repro steps
   - whether runtime API/Keycloak verification was blocked.

## First flows to retest (highest signal)

1. **Auth**: Login (account + Google button only) → Home; live validation;
   Register; sign-out shows a spinner then lands on Login with **no raw Keycloak
   page**.
2. **Learn → Lesson detail → Practice player → Result/explanation** (full-screen
   player, option tiles ≥ 48 dp, verdicts + explanations readable).
3. **Review hub → Flashcard deck list → Flashcard review** (reveal + 4 grading
   buttons fit at 320–360 dp; Review tab stays selected).
4. **Bottom-nav sweep**: Home → Learn → Review → Progress → Settings, each tab
   selects its own index and keeps its own stack.
5. **Billing**: Subscription / plan cards (current plan + recommended badge,
   long localized names wrap).

## Guardrails

- Do not claim live data passed if local API/Keycloak were not running.
- Do not file intentional design choices as bugs (hero kanji glyph size,
  data-driven NPC tint colors, full-screen players outside the shell).
- Report honestly what could not be verified and why.
