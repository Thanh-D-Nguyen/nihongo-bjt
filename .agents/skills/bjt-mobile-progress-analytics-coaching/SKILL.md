---
name: bjt-mobile-progress-analytics-coaching
description: Implement, audit, or polish the learner Progress, analytics, and coaching surfaces in the Nihongo BJT Flutter mobile app \u2014 real progress summaries, estimated BJT band (clearly labeled), weak-point insights, study-time trends, and supportive coaching nudges. Use when building progress dashboards or learner analytics with real event/rollup data only.
---

# BJT Mobile Progress, Analytics & Coaching Skill

Use this skill when implementing, auditing, or polishing learner progress,
analytics, and coaching. Follow the `bjt-mobile-foundation-quality-gate`
baseline.

## Goal

Show learners honest, motivating progress and actionable coaching based on real
event/rollup data — never fake charts or inflated metrics.

## Core principle

All analytics use **real events/rollups** from the server. Estimated scores are
clearly labeled estimated. Coaching is supportive, not shaming.

## Hard rules

- No fake charts, fake streaks, fake mastery, or invented trends.
- Estimated BJT score/band must be explicitly labeled as estimated.
- Weak points and recommendations derive from real competency/mistake data and
  are explainable.
- Coaching nudges are encouraging; no shame-based or dark-pattern messaging.
- Honest empty states when a learner has insufficient history.
- Keep VI/JA localization in sync. Support light/dark, 360–390 dp. Add/update
  tests.

## Required audit before coding

Inspect:
- web progress/analytics/coaching APIs, rollup models, estimated-band logic,
  weak-point/recommendation sources
- mobile progress page/providers, home progress summary, review weak-points,
  l10n, tokens, charting widgets, tests

Create/update:
- `docs/mobile/PROGRESS_ANALYTICS_WEB_PARITY_AUDIT.md`
- `docs/mobile/PROGRESS_ANALYTICS_CONTRACT.md`
- `docs/mobile/PROGRESS_ANALYTICS_IMPLEMENTATION_PLAN.md`

## Required surfaces

1. Progress overview: study time, completed items, accuracy trends (real data).
2. Estimated BJT band card, clearly labeled estimated, with how-derived note.
3. Weak-point insights with a path to remediation (links into Review/SRS).
4. Coaching nudges (next best action) tied to real data, supportive tone.
5. All states; honest "not enough data yet" empty state.

## Required tests

- progress overview populated/empty/error from real-shaped data
- estimated band shows the estimated label
- weak points link into remediation
- coaching nudge reflects real data; no fake metric
- charts handle sparse/empty data without misleading visuals
- dark mode, 360 dp, long VI/JA text

## Verification

`cd apps/mobile && flutter analyze` · `flutter test` · `git diff --check`.
Stop if red. Report files changed, commands + results, and confirmation that no
metric is fabricated.
