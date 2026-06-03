# NihonGo BJT — Mobile Product Guide

Status: living document. Owns the product direction for the Flutter app in
`apps/mobile`. Engineering rules live in
`.github/instructions/mobile.instructions.md`; the visual system lives in
`MOBILE_DESIGN_SYSTEM.md`; the per-screen quality bar lives in
`MOBILE_SCREEN_CHECKLIST.md`.

## 1. Product vision

NihonGo BJT is a serious Japanese business-communication learning product for
Vietnamese learners preparing for the BJT (Business Japanese Proficiency Test)
and for everyday business Japanese. The mobile app is the daily-practice
surface: calm, focused, fast, and respectful of the learner's time. It should
feel like a premium study companion — closer to a well-made reading/study app
than to a gamified streak machine.

The bar: every screen should be more considered than the equivalent screen in
Duolingo, Bunpo, WaniKani, or Anki — especially in Japanese readability and
calm focus.

## 2. Target users

- **Primary:** Vietnamese professionals and students studying business Japanese,
  often at JLPT N4–N1 / BJT levels, who cannot yet read every Japanese word and
  need reading support (furigana/kana, meanings) without it becoming a crutch.
- **Context:** mobile-first, frequently on the go, sometimes offline (commute),
  short focused sessions plus occasional longer study blocks.
- **Languages:** UI defaults to Vietnamese; Japanese UI is fully supported.
  Learning content is Japanese with Vietnamese support.

## 3. Core learning flows

1. **Daily dashboard** — what to study now, review-due count, sync status,
   continue-where-you-left-off.
2. **Learn** — structured business-Japanese content: vocabulary, expressions,
   BJT-style questions, explanations. (Built incrementally; foundation first.)
3. **Review** — spaced-repetition flashcards (SRS), offline-capable, syncs when
   back online. (Flashcard engine already exists.)
4. **Progress** — honest, measurable progress: streak/consistency, mastery,
   review history. No inflated or fake metrics.
5. **Settings / profile** — identity, app language, furigana preference,
   sign-out.

## 4. Navigation

Bottom tab shell with five primary destinations:

| Tab | Purpose |
| --- | --- |
| **Home** | Daily learning dashboard and entry points. |
| **Learn** | Business-Japanese learning content hub. |
| **Review** | SRS flashcard review. |
| **Progress** | Honest progress and history. |
| **Settings** | Profile, language, preferences, sign-out. |

Full-screen focus flows (e.g. an active review session, exam mode) may cover the
tab bar to protect concentration.

## 5. Screen list (incremental)

Foundation (this phase): app shell, theme (light/dark), tokens, reusable
components, Home dashboard, Settings, and clearly-marked placeholders for Learn,
Review, and Progress.

Planned: lesson list and lesson detail, BJT question practice and explanation,
vocabulary browser with reading assist, review session and session summary,
progress detail, search.

## 6. UX principles

- **Calm focus.** Reduce noise; one primary action per screen. No distraction
  loops, no fake urgency.
- **Clarity over decoration.** Depth via subtle elevation and spacing, not heavy
  gradients or glass.
- **Immediate, gentle feedback.** Every action responds; answer feedback is
  clear and non-punishing.
- **Honest progress.** Only show metrics backed by real data.
- **Respect the learner's time.** Fast loads, content-shaped skeletons, no
  blocking spinners.

## 7. Japanese & Vietnamese readability

- Japanese running text uses tall line-height (≥ 1.8); kanji/kana never cramped.
  Never shrink Japanese for visual effect.
- Reading help (furigana/kana, meanings) is available to free users, surfaced
  through the shared reading-assist layer, and suppressed during active timed
  exam/recall (revealed after answering or in practice/help mode).
- Vietnamese diacritics must never clip; keep line-height ≥ 1.5 and avoid tight
  fixed-height text containers.
- Both languages must look first-class in both light and dark themes.

## 8. Offline & network behavior

- Review works offline; grades queue locally (drift) and sync when back online.
- Connectivity-relevant screens surface an `OfflineBanner` and degrade
  gracefully (cached content, queued writes) rather than erroring.
- Network errors are recoverable: clear message + retry, never a dead end.

## 9. Accessibility expectations

- Light and dark themes, WCAG AA contrast in both.
- Touch targets ≥ 48×48 dp.
- Respects system text scaling and reduced-motion.
- Meaningful semantics/labels for interactive controls and icons.

## 10. What "production-ready" means here

A mobile screen is production-ready only when it has: correct behavior on real
data; normal/loading/empty/error/offline states (as applicable); light + dark
support; SafeArea; responsive layout without overflow; localized strings (vi +
ja); correct Japanese/Vietnamese typography; adequate touch targets; reused
shared components; and passing `flutter analyze` + `flutter test`. No fake data,
no swallowed errors, no placeholder standing in for required behavior.
