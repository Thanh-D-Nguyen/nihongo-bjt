---
mode: agent
description: Implement exactly one NihonGo BJT mobile (Flutter) screen, production-grade, one at a time.
---

# Implement one mobile screen

You are implementing **exactly one** screen in `apps/mobile`. Do not implement
other screens, do not refactor unrelated code, do not redesign the web/backend.

## Inputs (ask the user if missing)

- **Screen name / route** and where it lives in the navigation.
- **Screen spec** (behavior, data source, states, actions). If there is no
  written spec, ask for one or restate your understanding and get confirmation
  before coding.

## Required reading first (do not skip)

1. `.github/instructions/mobile.instructions.md`
2. `docs/mobile/MOBILE_DESIGN_SYSTEM.md`
3. `docs/mobile/MOBILE_SCREEN_CHECKLIST.md`
4. `docs/mobile/MOBILE_PRODUCT_GUIDE.md` (the relevant flow)
5. The existing tokens (`apps/mobile/lib/core/theme/*`) and shared widgets
   (`apps/mobile/lib/shared/widgets/*`), plus any existing feature code this
   screen builds on.

## Rules

- Implement **one screen only**. Stop when it is done.
- **Reuse** shared components (`AppScaffold`, `AppCard`, `PrimaryButton`,
  `SecondaryButton`, `AppChip`, `SectionHeader`, `LoadingStateView`,
  `EmptyStateView`, `ErrorStateView`, `OfflineBanner`, `LearningProgressCard`).
  If something is missing, extend the shared layer rather than copy-pasting.
- Use **design tokens** for all colors/spacing/radius/shadow/motion. No magic
  numbers, no hardcoded hex.
- Handle every applicable state: normal, loading, empty, error, offline.
- Light **and** dark mode; SafeArea; responsive (320 dp → large); no overflow.
- All strings via `AppLocalizations` (add keys to `app_vi.arb` **and**
  `app_ja.arb`, then regenerate). Correct Japanese, natural Vietnamese.
- Correct Japanese/Vietnamese typography per the design system.
- Touch targets ≥ 48 dp; focus/press states present.
- No backend/API/DB changes unless strictly required (and call it out).
- No new dependency unless clearly justified.

## Tests

- Add or update widget tests for the new screen's states (normal/empty/error and
  any key interaction). Keep the existing suite green.

## Verify before reporting

- Run `flutter analyze` (must be clean) and `flutter test` (must pass).
- If a command cannot run, say which and why. Do not claim done otherwise.

## Report

1. What you implemented (one screen).
2. Exact files changed.
3. Verification commands run and results.
4. Checklist pass/fail (use `MOBILE_SCREEN_CHECKLIST.md`).
5. Known limitations / follow-ups.
