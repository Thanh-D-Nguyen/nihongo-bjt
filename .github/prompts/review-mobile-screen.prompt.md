---
mode: agent
description: Review one NihonGo BJT mobile screen against the production checklist and report concrete fixes.
---

# Review one mobile screen

Review **one** screen in `apps/mobile` against the production checklist and
produce a concrete, prioritized fix list. This is a **review** task: report
findings and exact fixes; only apply changes if the user explicitly asks.

## Inputs (ask if missing)

- Which screen (file/route).

## Required reading first

1. `docs/mobile/MOBILE_SCREEN_CHECKLIST.md`
2. `.github/instructions/mobile.instructions.md`
3. `docs/mobile/MOBILE_DESIGN_SYSTEM.md`
4. The screen's implementation and the shared widgets/tokens it uses.

## How to review

Go through every section of `MOBILE_SCREEN_CHECKLIST.md` and judge the screen
against it. For each item, mark **Pass / Fail / N/A**. Inspect the real code —
do not assume. Where relevant, check both themes, small/large widths, vi/ja, and
large text scale.

## Findings format

For every failing or weak item, report:

- **Item** (checklist section + name).
- **Severity** (blocker / major / minor).
- **Evidence** (file + line, or precise description).
- **Concrete fix** (the exact change to make, referencing tokens/components).

Group findings by severity. End with a short prioritized action list.

## Verify

- If you ran anything (`flutter analyze`, `flutter test`), report results. If you
  did not run commands, say so.

## Report

1. Per-section checklist result table (Pass/Fail/N/A).
2. Findings with severity, evidence, and concrete fixes.
3. Prioritized action list.
4. Whether the screen is production-ready as-is (yes/no + why).
