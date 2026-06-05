---
name: bjt-mobile-sharing-referral-postcard
description: Build, audit, or polish privacy-safe sharing, referral, and share-postcard generation in the Nihongo BJT Flutter mobile app \u2014 achievement/quiz/battle/daily-phrase share cards, public share links, OG-safe metadata, and referral campaigns. Use when implementing any share, referral, or postcard surface without leaking private learning data.
---

# BJT Mobile Sharing, Referral & Postcard Skill

Use this skill when implementing, auditing, or polishing sharing, referral, and
share-postcard features. Follow the `bjt-mobile-foundation-quality-gate`
baseline.

## Goal

Let learners share achievements, BJT quiz/exam results, battle results, and
daily phrases through beautiful, privacy-safe postcards and public links — and
support referral campaigns — without exposing private learning data.

## Core principle

Sharing is **privacy-safe by construction**. Public URLs and OG metadata expose
only what the share template intends — never raw learning history or private
account data.

## Hard rules

- Generate privacy-safe public share URLs; no private raw learning history in the
  URL or OG metadata.
- Use real share templates/providers or an explicit local provider — no fake
  share that does nothing.
- Respect user consent/visibility settings before sharing.
- Postcards render real, allowed data only (no fabricated stats/badges).
- Referral codes/campaigns come from the real referral contract.
- Use the platform share sheet correctly; handle cancel/failure gracefully.
- Keep VI/JA localization in sync. Support light/dark, 360–390 dp. Add/update
  tests.

## Required audit before coding

Inspect:
- web share pages, postcard/OG generation, share templates, referral APIs,
  consent/visibility settings, models
- mobile achievement/quiz/exam/battle/daily-phrase result surfaces, settings
  (consent), share/deep-link setup, l10n, tokens, tests

Create/update:
- `docs/mobile/SHARING_REFERRAL_WEB_PARITY_AUDIT.md`
- `docs/mobile/SHARING_PRIVACY_POLICY.md` (what is and isn't shareable)
- `docs/mobile/SHARING_REFERRAL_IMPLEMENTATION_PLAN.md`

## Required surfaces

1. Share entry points on achievement / quiz-exam result / battle result / daily
   phrase.
2. Postcard preview (real data, themed, Japanese/Vietnamese readable).
3. Privacy-safe public link generation + platform share sheet.
4. Referral screen: code, invite, campaign state, real reward terms.
5. Consent/visibility checks before any share; all states.

## Required tests

- share entry produces a postcard preview from real data
- private fields never appear in the generated share payload/URL
- consent off blocks share with clear messaging
- referral code renders from real contract; copy/invite works
- share sheet cancel/failure handled
- dark mode, 360 dp, long VI/JA text

## Verification

`cd apps/mobile && flutter analyze` · `flutter test` · `git diff --check`.
Stop if red. Report files changed, commands + results, and a privacy check
confirming no private data leaks into share URLs/metadata.
