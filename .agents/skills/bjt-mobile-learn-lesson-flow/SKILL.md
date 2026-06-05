---
name: bjt-mobile-learn-lesson-flow
description: Implement, audit, or polish the Learn tab lesson experience and learning paths in the Nihongo BJT Flutter mobile app \u2014 lesson list, lesson detail/player, structured progression, and adaptive/explainable path sequencing tied to real competency/progress data. Use when building lesson screens or learning-path surfaces (distinct from practice/exam flows).
---

# BJT Mobile Learn / Lesson Flow Skill

Use this skill when implementing, auditing, or polishing the Learn tab lessons
and learning paths. Follow the `bjt-mobile-foundation-quality-gate` baseline.
Focused practice/exam sessions belong to `bjt-exam-practice-flow`; this skill
owns lesson browsing, the lesson detail/player, and path sequencing.

## Goal

Give learners a clear "what to study next" experience: structured lessons and
learning paths backed by real progress data, with an obvious primary action.

## Core principle

Learning paths connect to **real competency/progress data** and are
**explainable** — recommendations show why. No static fake path cards.

## Hard rules

- Do not fake lesson progress, completion, lock state, or recommendations.
- Do not invent lesson/path APIs. Reuse the web lesson/learning-path contract.
- A lesson/path card must navigate to a real screen or show honest unavailable
  state — no dead cards, no fake "locked" without real gating.
- Premium/locked lessons defer to `bjt-mobile-monetization-paywall` (server
  entitlement), not local guesses.
- Continue-learning / next-best-action must reflect real last-position data.
- Japanese content uses the reading-assist layer where appropriate.
- Keep VI/JA localization in sync. Support light/dark, 360–390 dp. Add/update
  tests.

## Required audit before coding

Inspect:
- web lessons, lesson detail, learning-paths, progress/competency APIs, hooks,
  models, recommendation logic, lock/premium handling
- mobile learn page, lesson detail page, learn providers, progress providers,
  entitlement provider, reading-assist, l10n, tokens, tests

Create/update:
- `docs/mobile/LEARN_LESSON_WEB_PARITY_AUDIT.md`
- `docs/mobile/LEARN_PATH_CONTRACT.md`
- `docs/mobile/LEARN_LESSON_IMPLEMENTATION_PLAN.md`

## Required surfaces

1. Learn home: structured sections / paths, continue-learning CTA, recommended
   next action with a short reason.
2. Lesson detail/player: content blocks (text/audio/Japanese via reading-assist),
   progress tracking, completion persistence, entry to practice.
3. Learning path view: ordered steps, real lock/progress state, explainable
   recommendation.
4. All states (loading/empty/error/offline), honest when data is absent.

## Required tests

- learn home populated/empty/error
- lesson detail renders content; progress persists
- continue-learning reflects real last position
- recommendation shows reason; no fake path card
- locked lesson defers to entitlement (no local `isPremium`)
- Japanese content uses reading-assist and keeps line-height
- dark mode, 360 dp, long VI/JA text

## Flutter skills to use

`flutter-build-responsive-layout`, `flutter-fix-layout-issues`,
`flutter-add-widget-test`, `flutter-add-integration-test`,
`flutter-use-http-package`, `flutter-implement-json-serialization`.

## Verification

`cd apps/mobile && flutter analyze` · `flutter test` · `git diff --check`.
Stop if red. Report files changed, commands + results, and progress-persistence
evidence.
