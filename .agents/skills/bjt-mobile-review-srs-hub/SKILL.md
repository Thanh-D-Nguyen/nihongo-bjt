---
name: bjt-mobile-review-srs-hub
description: Implement, audit, or polish the Review / SRS hub of the Nihongo BJT Flutter mobile app \u2014 due-items scheduling, review queue, mistake remediation from quiz/exam into cards, weak-point surfacing, and SRS result persistence. Use when building the Review tab, spaced-repetition flows, or remediation pipelines (distinct from raw flashcard CRUD).
---

# BJT Mobile Review / SRS Hub Skill

Use this skill when implementing, auditing, or polishing the Review hub and the
spaced-repetition (SRS) system. Follow the
`bjt-mobile-foundation-quality-gate` baseline. This skill owns scheduling and
remediation; deck/card CRUD belongs to `bjt-deck-flashcard-management`, and the
card recall screen to that skill too.

## Goal

Turn Review into a daily-useful hub that shows what is due, runs review
sessions, and feeds mistakes from quiz/exam back into review — all on real,
persisted SRS data.

## Core principle

Review is driven by **real scheduling and real results**, not a static list.
Every review outcome persists and updates the schedule.

## Hard rules

- Do not fake due counts, intervals, ease, or streaks.
- Do not invent SRS API responses. Reuse the web SRS/review contract.
- Persist every review result; never lose a graded outcome on navigation/back.
- Remediation: quiz/exam mistakes must be addable to review/cards through the
  real API or an honest unavailable state — no dead action.
- Weak-point surfacing uses real competency/mistake data only.
- Keep the Review tab active for review/flashcard flows launched from Review.
- Review session is a focused flow; do not let bottom nav conflict with the
  grade/CTA controls.
- Keep VI/JA localization in sync. Support light/dark, 360–390 dp. Add/update
  tests.

## Required audit before coding

Inspect:
- web review/SRS/mistakes/weak-point APIs, hooks, models, scheduling logic
- mobile review hub, flashcard review, practice/exam result flows, providers,
  drift cache, l10n, tokens, tests

Create/update:
- `docs/mobile/REVIEW_SRS_WEB_PARITY_AUDIT.md`
- `docs/mobile/REVIEW_SRS_CONTRACT.md`
- `docs/mobile/REVIEW_SRS_IMPLEMENTATION_PLAN.md`

## Required surfaces

1. Review hub: due-today summary, resume review CTA, weak points, saved/mistakes
   entry — real data with honest empty state.
2. Review session: queue, grade actions (per SRS scheme), progress, result
   persistence, offline-safe queueing if supported.
3. Remediation entry from quiz/exam result → add mistakes to review/cards.
4. Weak-point view tied to real competency/analytics data.
5. All states (loading/empty/error/offline).

## Required tests

- due-summary populated/empty/error
- review session grades persist (survive back/navigation)
- remediation adds a mistake to review/cards via real API mock
- weak points render from real data; honest empty state
- Review tab stays active across review/flashcard subroutes
- focused session has no CTA/bottom-nav conflict
- dark mode, 360 dp, long VI/JA text

## Flutter skills to use

`flutter-build-responsive-layout`, `flutter-add-widget-test`,
`flutter-add-integration-test`, `flutter-use-http-package`,
`flutter-implement-json-serialization`.

## Verification

`cd apps/mobile && flutter analyze` · `flutter test` · `git diff --check`.
Stop if red. Report files changed, commands + results, and persistence evidence.
