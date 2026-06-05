---
mode: agent
description: Run the NihonGo BJT mobile QA gate \u2014 checklist + flutter analyze/test \u2014 and block false "done".
---

# Mobile QA gate

Run the production QA gate for `apps/mobile` before any feature is called done.
Report evidence; never claim a pass without it.

## Inputs (ask if missing)

- **Scope**: the screen(s)/feature(s) to gate, or "whole app".

## Required reading first

1. `docs/mobile/MOBILE_SCREEN_CHECKLIST.md`.
2. `.agents/skills/bjt-mobile-foundation-quality-gate/SKILL.md`.
3. The domain skill(s) covering the scope (their "Required tests" sections).

## Steps

1. **Static + tests**:
   - `cd apps/mobile && flutter analyze` — must be clean.
   - `cd apps/mobile && flutter test` — must pass. Capture exact output.
2. **Checklist pass** for each in-scope screen, using
   `MOBILE_SCREEN_CHECKLIST.md` (functional, states, a11y, i18n vi/ja, Japanese
   & Vietnamese typography, SafeArea, responsive, dark mode, tokens/components,
   performance). Mark each item pass / fail / n/a-with-reason.
3. **Manual/widget verification matrix**: 320 dp and a large width × light/dark ×
   vi/ja. Note any overflow, clipping, contrast, or gating issues.
4. **Production-first checks**: no fake data presented as real, no local-only
   state that belongs server-side, no hardcoded `isPremium`, no swallowed errors,
   no dead routes/cards, exam reading-assist gating respected.

## Output

A QA report with: commands run + results, per-screen checklist results, the
verification matrix, and a clear **PASS / FAIL** verdict. On FAIL, list the exact
blocking items. Do not soften a FAIL into a PASS.

## Report

1. Scope gated.
2. analyze/test results (quoted).
3. Checklist + matrix results.
4. Verdict and blocking items (if any).
