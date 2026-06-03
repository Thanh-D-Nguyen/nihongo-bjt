---
mode: agent
description: Polish one existing NihonGo BJT mobile screen to production UI/UX quality without changing business logic.
---

# Polish one mobile screen

Raise **one existing** screen in `apps/mobile` to production UI/UX quality.
**Do not change business logic, data flow, routes, or backend contracts.** This
is a visual/interaction polish pass only.

## Inputs (ask if missing)

- Which screen (file/route).
- Any specific concerns (e.g. dark mode, spacing, Japanese readability).

## Required reading first

1. `.github/instructions/mobile.instructions.md`
2. `docs/mobile/MOBILE_DESIGN_SYSTEM.md`
3. `docs/mobile/MOBILE_SCREEN_CHECKLIST.md`
4. The screen's current implementation and the shared widgets/tokens it uses.

## Scope (allowed)

- Replace hardcoded values with design tokens.
- Swap ad-hoc UI for shared components.
- Fix spacing rhythm, alignment, radius/shadow harmony, icon sizing.
- Add/repair light + dark support (read colors from `context.palette`).
- Add missing loading/empty/error/offline states (presentation only).
- Improve Japanese/Vietnamese typography and overflow handling.
- Add press/hover/focus/disabled feedback and motion (calm, token-based).
- Improve SafeArea and responsiveness; fix overflow.

## Out of scope (do not touch)

- Business logic, providers/controllers behavior, data sources, navigation
  structure, API/DB, public widget APIs (unless purely additive and justified).

## Self-review (apply every item)

- Sizing/radius/icon consistency across siblings; touch targets ≥ 48 dp.
- Transition + press feedback on every interactive element; visible focus ring.
- No double borders; consistent semantic colors; consistent spacing scale.
- Light + dark verified; no dark-on-dark; AA contrast.
- Small-screen (320 dp) and large-font safe; no overflow.

## Verify before reporting

- `flutter analyze` clean; `flutter test` passing (logic tests must be
  unchanged and green). State which commands ran and results.

## Report

1. What you polished (one screen) and why each change improves it.
2. Exact files changed.
3. Confirmation that business logic/routes/contracts are unchanged.
4. Verification results.
5. Remaining limitations.
