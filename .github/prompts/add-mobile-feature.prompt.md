---
mode: agent
description: Implement one NihonGo BJT mobile feature as a full production vertical slice, driven by the matching bjt-mobile-* skill.
---

# Implement one mobile feature (vertical slice)

Implement **one** feature in `apps/mobile` as a complete production vertical
slice. Not just a screen — the model, data, states, i18n, and tests. Do not
implement other features or refactor unrelated code.

## Inputs (ask if missing)

- **Feature** and the **domain skill** that governs it (one of the
  `.agents/skills/bjt-*` skills).
- **Spec / parity audit** for the feature. If absent, run
  `audit-mobile-parity.prompt.md` first or restate and confirm scope.

## Required reading first

1. The matching domain skill in `.agents/skills/bjt-*` (follow it exactly).
2. `.agents/skills/bjt-mobile-foundation-quality-gate/SKILL.md` (baseline).
3. `.github/instructions/mobile.instructions.md`,
   `docs/mobile/MOBILE_DESIGN_SYSTEM.md`, `docs/mobile/MOBILE_SCREEN_CHECKLIST.md`.
4. The domain's web API contract and existing mobile code it builds on.

## Vertical slice (definition of done)

- Typed model + API client contract (reuse the web contract; no invented APIs).
- Real persistence or an explicit provider abstraction.
- Riverpod providers/repositories following existing patterns.
- Screen(s) with **all** applicable states (normal/loading/empty/error/offline),
  reusing shared widgets and design tokens.
- i18n keys in **both** `app_vi.arb` and `app_ja.arb`, regenerated. Natural
  Vietnamese, correct Japanese.
- Auth/RBAC/entitlement boundary where relevant (server-enforced; no local
  `isPremium`).
- Reading-assist for Japanese passages where applicable; exam-gating respected.
- Widget/unit tests for core logic and key states; integration test if feasible.
- No dead routes/cards; no placeholder styled as real data.

## Rules

- Follow the domain skill's hard rules and required surfaces/tests.
- No backend/API/DB changes unless strictly required (call it out).
- No new dependency unless clearly justified.
- Keep changes scoped to this feature.

## Verify before reporting

- `cd apps/mobile && flutter analyze` (clean) and `flutter test` (passing).
- Manually verify (or widget-test) at 320 dp and a large width, light + dark,
  vi + ja. If a command cannot run, say which and why.

## Report

1. Feature implemented and the governing skill.
2. Exact files changed.
3. Verification commands run and results.
4. `MOBILE_SCREEN_CHECKLIST.md` pass/fail.
5. Parity status update (Done/Partial) and known limitations.
