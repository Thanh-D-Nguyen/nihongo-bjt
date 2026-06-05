---
name: bjt-mobile-onboarding-placement
description: Build, audit, or polish first-run onboarding and the BJT placement flow in the Nihongo BJT Flutter mobile app \u2014 welcome, goal/level selection, placement assessment, and initial level/path assignment persisted server-side. Use when implementing the new-user experience or placement test that calibrates a learner's starting level.
---

# BJT Mobile Onboarding & Placement Skill

Use this skill when implementing, auditing, or polishing first-run onboarding
and placement. Follow the `bjt-mobile-foundation-quality-gate` baseline. The
placement assessment reuses the practice/exam engine where possible
(`bjt-exam-practice-flow`); this skill owns the onboarding journey and level
assignment.

## Goal

Get a new learner from install to a calibrated starting point quickly and
calmly: understand their goal, run an optional placement, and assign an initial
level/path persisted to the server.

## Core principle

Onboarding sets up **real, persisted** learner state (goal, level, path). No
fake "you're N5" without a real placement or explicit user choice.

## Hard rules

- Persist onboarding/placement results server-side; cross-device consistent. No
  localStorage-only state.
- Do not fake placement scoring. Use the real assessment/placement contract.
- Estimated BJT level/band must be clearly labeled as estimated.
- Onboarding is skippable where product allows; never trap the user.
- No shame-based messaging; calm and encouraging tone.
- Respect exam-integrity rules during the placement assessment (reading-assist
  gating).
- Keep VI/JA localization in sync. Support light/dark, 360–390 dp. Add/update
  tests.

## Required audit before coding

Inspect:
- web onboarding/placement/level-assignment APIs, hooks, models, scoring
- mobile auth flow, router redirect/guards (first-run detection), profile/level
  providers, practice/exam engine, l10n, tokens, tests

Create/update:
- `docs/mobile/ONBOARDING_PLACEMENT_WEB_PARITY_AUDIT.md`
- `docs/mobile/ONBOARDING_PLACEMENT_CONTRACT.md`
- `docs/mobile/ONBOARDING_PLACEMENT_IMPLEMENTATION_PLAN.md`

## Required surfaces

1. Welcome / value intro (brief, skippable).
2. Goal + target selection (e.g., BJT band goal, daily time) persisted.
3. Placement assessment (optional): short adaptive/fixed set via the exam
   engine, server-scored.
4. Result + initial level/path assignment, clearly labeled estimated, persisted.
5. First-run routing: detect new vs returning user; route cleanly into Home.
6. All states (loading/empty/error/offline).

## Required tests

- new-user detection routes into onboarding; returning user skips it
- goal/level selection persists (server mock)
- placement runs and server-scores; result labeled estimated
- skip path works without trapping the user
- reading-assist gated during placement
- dark mode, 360 dp, long VI/JA text

## Verification

`cd apps/mobile && flutter analyze` · `flutter test` · `git diff --check`.
Stop if red. Report files changed, commands + results, and persistence evidence.
