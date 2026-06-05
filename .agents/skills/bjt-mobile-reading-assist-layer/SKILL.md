---
name: bjt-mobile-reading-assist-layer
description: Build, audit, or polish the reusable Japanese Reading Assist layer in the Nihongo BJT Flutter mobile app \u2014 tap/hover readings, furigana, inline meanings, add-to-flashcard, and exam-mode gating \u2014 as a product layer (via JapaneseText), not page-specific tooltips. Use whenever Japanese text must be made readable for learners or when enforcing exam-integrity reading rules.
---

# BJT Mobile Reading Assist Layer Skill

Use this skill when implementing, auditing, or polishing the Japanese Reading
Assist layer for the Nihongo BJT mobile app. Follow the
`bjt-mobile-foundation-quality-gate` baseline; this skill only adds the
reading-assist specifics.

## Goal

Make Japanese text readable for learners who cannot read every word, through a
single reusable product layer, so any Japanese string in the app can opt into
reading help consistently — not via one-off tooltips per screen.

The layer (rendered through `features/reading_assist/presentation/japanese_text.dart`)
must support:
- tap / long-press reading (kana/romaji per setting)
- furigana rendering
- inline meaning (VI primary, with reading)
- add-to-flashcard action
- reading-assist analytics events (only when real tracking exists)

## Core principle

Reading assist is a **product layer**, not decoration. One `JapaneseText`
component, one policy, used everywhere Japanese appears.

## Exam-integrity policy (hard requirement)

- During an **active timed exam**, meanings/readings must be hidden unless the
  flow is practice/help mode or the question has already been answered.
- The gating decision lives in the reading-assist layer / a shared policy
  provider, **not** in each screen. A screen passes its mode; the layer enforces.
- Free users keep basic reading support outside active exam mode.

## Hard rules

- Do not fake readings, furigana, or meanings. Use real dictionary/content API
  or real local data only.
- Do not invent API responses. Reuse the web reading/dictionary contract.
- Do not bypass exam gating anywhere.
- Do not block UI on reading lookups; show inline loading/disabled state.
- Reading-assist tap targets ≥ 48×48 dp; do not break paragraph flow or
  Japanese line-height (≥ 1.8).
- Add-to-flashcard must hit the real saved/deck API or show honest unavailable
  state — no dead action.
- Keep VI/JA localization in sync. Support light/dark, 360–390 dp.
- Add/update tests, including exam-gating tests.

## Required audit before coding

Inspect:
- web reading-assist / furigana / dictionary-tooltip implementation, its API,
  models, and exam-mode handling
- mobile `japanese_text.dart`, reading-assist providers, dictionary/saved/deck
  providers, exam/practice mode flags, l10n, tokens, tests

Create/update:
- `docs/mobile/READING_ASSIST_WEB_PARITY_AUDIT.md`
- `docs/mobile/READING_ASSIST_POLICY.md` (gating + free-tier rules)
- `docs/mobile/READING_ASSIST_IMPLEMENTATION_PLAN.md`

## Required behavior

1. `JapaneseText` API: accepts text, optional readings/furigana data, a mode
   (normal / practice / active-exam / post-answer), and callbacks.
2. Tap interaction: reading + meaning sheet/popover, add-to-flashcard, save.
3. Furigana toggle wired to the user reading preference (server/local setting).
4. Exam gating enforced centrally.
5. Graceful states when lookup data is missing or backend is down.

## Required tests

- furigana on/off rendering
- tap shows reading/meaning in normal mode
- active-exam mode hides meaning; post-answer reveals it
- practice/help mode allows reading
- add-to-flashcard calls real API / honest unavailable state
- long Japanese paragraph keeps line-height and no overflow
- dark mode, 360 dp, large textScaler

## Flutter skills to use

`flutter-build-responsive-layout`, `flutter-fix-layout-issues`,
`flutter-add-widget-test`, `flutter-add-widget-preview`,
`flutter-use-http-package`, `flutter-implement-json-serialization`.

## Verification

`cd apps/mobile && flutter analyze` · `flutter test` · `git diff --check`.
Stop if red. Report files changed, commands run, and exam-gating evidence.
