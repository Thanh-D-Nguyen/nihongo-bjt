---
name: bjt-mobile-content-reading
description: Implement, audit, or polish editorial/reading content surfaces in the Nihongo BJT Flutter mobile app \u2014 News, Magazine, Scenarios, and Career reading experiences \u2014 with integrated Reading Assist, comfortable Japanese typography, and real content APIs. Use when building or refining long-form Japanese reading content for learners.
---

# BJT Mobile Content & Reading Skill

Use this skill when implementing, auditing, or polishing editorial reading
content: News, Magazine, Scenarios, and Career. Follow the
`bjt-mobile-foundation-quality-gate` baseline. Japanese readability is delivered
through `bjt-mobile-reading-assist-layer`; interactive scenario/career play
flows may use `bjt-exam-practice-flow` patterns for focused routes.

## Goal

Make long-form Japanese content a pleasure to read and learn from: clean
editorial layout, comfortable Japanese typography, and integrated reading help,
backed by real content APIs.

## Core principle

Content is a **reading-to-learning** surface. Every Japanese passage can opt into
reading assist; meanings/readings stay available outside active exam mode.

## Hard rules

- Use real content APIs (news/magazine/scenarios/career); no fake articles.
- Japanese running text uses Japanese tokens (line-height ≥ 1.8) and the
  reading-assist layer for tap reading/furigana/meaning/add-to-flashcard.
- Media/images require correct sizing and respect provenance/license metadata
  from the content contract.
- Cards/links navigate to real detail screens or honest unavailable states.
- Premium/locked content defers to `bjt-mobile-monetization-paywall`.
- Keep VI/JA localization in sync. Support light/dark, 360–390 dp. Add/update
  tests.

## Required audit before coding

Inspect:
- web news/magazine/scenario/career content APIs, models, media handling,
  reading-assist integration, lock/premium handling
- mobile news/magazine/scenarios/career pages, providers, reading-assist,
  entitlement provider, l10n, tokens, tests

Create/update:
- `docs/mobile/CONTENT_READING_WEB_PARITY_AUDIT.md`
- `docs/mobile/CONTENT_READING_CONTRACT.md`
- `docs/mobile/CONTENT_READING_IMPLEMENTATION_PLAN.md`

## Required surfaces

1. Content list (news/magazine/scenarios/career) with real data and states.
2. Content detail/reader: editorial layout, Japanese via reading-assist, media,
   add-to-flashcard from passages.
3. Scenario/career interactive play as focused flows where applicable.
4. Save/bookmark integration with the real saved API.
5. All states (loading/empty/error/offline).

## Required tests

- content list populated/empty/error
- detail renders Japanese via reading-assist with correct line-height
- add-to-flashcard from a passage hits real API / honest unavailable
- locked content defers to entitlement (no local `isPremium`)
- media sizing no overflow; dark mode, 360 dp, long VI/JA text

## Flutter skills to use

`flutter-build-responsive-layout`, `flutter-fix-layout-issues`,
`flutter-add-widget-test`, `flutter-use-http-package`,
`flutter-implement-json-serialization`.

## Verification

`cd apps/mobile && flutter analyze` · `flutter test` · `git diff --check`.
Stop if red. Report files changed, commands + results, and reading-assist
integration evidence.
