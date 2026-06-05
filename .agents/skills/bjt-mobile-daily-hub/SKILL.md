---
name: bjt-mobile-daily-hub
description: Build, audit, or polish the Daily learning hub of the Nihongo BJT Flutter mobile app \u2014 daily phrase/lesson, daily standup routine, daily-life Japanese, and streak-driving daily engagement \u2014 tied to real daily-content APIs. Use when implementing the daily-life learner surface (/daily, /daily-standup equivalents), distinct from structured lessons and the Home dashboard.
---

# BJT Mobile Daily Hub Skill

Use this skill when implementing, auditing, or polishing the Daily learning hub.
Follow the `bjt-mobile-foundation-quality-gate` baseline. The Daily hub is the
joyful daily-life counterpart to structured Learn lessons; engagement mechanics
defer to `bjt-mobile-gamification-streaks`, and Japanese passages render through
`bjt-mobile-reading-assist-layer`.

## Goal

Give learners a calm, rewarding daily touchpoint: today's phrase/lesson, a short
daily standup/routine, and daily-life Japanese — driving consistent return
without noise or fake streaks.

## Core principle

Daily content is **real and dated** from the server. "Today" reflects the real
daily item; completion persists. No fabricated daily streaks or fake phrases.

## Hard rules

- Use the real daily-content / daily-standup APIs. No fake daily items.
- Daily completion persists server-side and feeds streak/progress honestly.
- Japanese phrases use the reading-assist layer (furigana/meaning/add-to-flashcard).
- Add-to-flashcard from a daily phrase hits the real saved/deck API or shows an
  honest unavailable state.
- Sharing a daily phrase defers to `bjt-mobile-sharing-referral-postcard`
  (privacy-safe).
- Calm tone; no shame for missed days; encouraging re-entry.
- Keep VI/JA localization in sync. Support light/dark, 360–390 dp. Add/update
  tests.

## Required audit before coding

Inspect:
- web `/daily`, `/daily/[id]`, `/daily-standup` pages, daily-content APIs,
  models, streak linkage, share/add-to-flashcard behavior
- mobile home dashboard (daily entry), reading-assist, saved/deck providers,
  gamification providers, l10n, tokens, tests

Create/update:
- `docs/mobile/DAILY_HUB_WEB_PARITY_AUDIT.md`
- `docs/mobile/DAILY_HUB_CONTRACT.md`
- `docs/mobile/DAILY_HUB_IMPLEMENTATION_PLAN.md`

## Required surfaces

1. Daily today card / hub entry (from Home and/or its own route).
2. Daily phrase/lesson detail: Japanese via reading-assist, meaning, audio if
   supported, add-to-flashcard, mark-complete (persisted).
3. Daily standup/routine: short ordered daily actions reflecting real state.
4. Honest streak/return state (defer mechanics to gamification skill).
5. All states (loading/empty/error/offline).

## Required tests

- daily today card renders the real dated item; empty/error states
- daily detail uses reading-assist with correct Japanese line-height
- mark-complete persists and is reflected on re-entry
- add-to-flashcard calls real API / honest unavailable
- no fake streak when data absent
- dark mode, 360 dp, long VI/JA text

## Verification

`cd apps/mobile && flutter analyze` · `flutter test` · `git diff --check`.
Stop if red. Report files changed, commands + results, and persistence evidence.
