---
name: bjt-mobile-gamification-streaks
description: Implement, audit, or polish gamification in the Nihongo BJT Flutter mobile app \u2014 streaks, badges/achievements, XP/rewards, and leaderboards \u2014 with real backend data, calm business-learning tone, and no fake or shame-based mechanics. Use when building the rewards/streaks surfaces or engagement loops on mobile.
---

# BJT Mobile Gamification & Streaks Skill

Use this skill when implementing, auditing, or polishing gamification. Follow the
`bjt-mobile-foundation-quality-gate` baseline. Keep the serious, calm
business-learning tone (see `bjt-mobile-sensory-design`).

## Goal

Motivate consistent study with honest, lightweight gamification — streaks,
badges, XP, leaderboards — backed by real data, without turning the app into a
noisy casual game.

## Core principle

Engagement mechanics use **real backend data** and support learning. No fake
streaks, no manipulative loops, no shame for breaking a streak.

## Hard rules

- No fake streaks, badges, XP, or ranking. Use the real gamification contract.
- Streak logic reflects server truth; never fabricate or "repair" client-side.
- Leaderboards show real, privacy-respecting data only.
- Calm tone: no aggressive animations, no casino/childish styling, no
  shame-based streak-loss messaging.
- No engagement nudge interrupts active study/exam focus.
- Premium-gated rewards defer to `bjt-mobile-monetization-paywall`.
- Keep VI/JA localization in sync. Support light/dark, 360–390 dp. Add/update
  tests.

## Required audit before coding

Inspect:
- web gamification/streak/badge/XP/leaderboard APIs, models, rules
- mobile rewards page/providers, home engagement section, sensory tokens, l10n,
  tests

Create/update:
- `docs/mobile/GAMIFICATION_WEB_PARITY_AUDIT.md`
- `docs/mobile/GAMIFICATION_CONTRACT.md`
- `docs/mobile/GAMIFICATION_IMPLEMENTATION_PLAN.md`

## Required surfaces

1. Streak display + honest state (active/at-risk/broken) from server.
2. Badges/achievements list with earned/locked real state.
3. XP/rewards summary if supported.
4. Leaderboard (real, privacy-safe) if supported.
5. All states; honest empty state for new users.

## Required tests

- streak renders server value; at-risk/broken states honest
- badges earned/locked from real data
- leaderboard renders real data; privacy-safe
- no fake count when data absent
- calm motion respects reduced-motion
- dark mode, 360 dp, long VI/JA text

## Verification

`cd apps/mobile && flutter analyze` · `flutter test` · `git diff --check`.
Stop if red. Report files changed and commands + results.
