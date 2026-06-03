# NihonGo BJT — Mobile Implementation Roadmap (Phase 02)

Status: living document. Owns the batch plan for building the production mobile
learning experience on top of Mobile Phase 01.

Companion docs:
- Engineering rules: `.github/instructions/mobile.instructions.md`
- Product direction: `MOBILE_PRODUCT_GUIDE.md`
- Visual system: `MOBILE_DESIGN_SYSTEM.md`
- Per-screen quality bar: `MOBILE_SCREEN_CHECKLIST.md`
- Batch execution record: `MOBILE_BATCH_LOG.md`
- Final manual QA: `MOBILE_MANUAL_QA_CHECKLIST.md`
- Automated self-QA report: `MOBILE_AI_QA_REPORT.md`
- Known limitations / deferred debt: `MOBILE_KNOWN_LIMITATIONS.md`

## Baseline (verified before Phase 02)

- Flutter 3.44 / Dart 3.12, Riverpod + go_router + drift, strict
  `very_good_analysis`.
- `flutter analyze` clean; `flutter test` green (122 tests).
- Light/dark theme, `AppPalette` ThemeExtension, `AppMotion`, full token set,
  reusable base components, 5-tab `AppShell`, `StatefulShellRoute.indexedStack`.
- Real Home dashboard wired to the flashcard repository. Learn / Review /
  Progress are honest placeholders. Flashcard SRS engine exists (mock + API
  sources, offline queue).

## Key architectural decision: lesson/question content source

The mobile app currently has **no backend API for lessons or BJT questions**
(only flashcards). To avoid faking backend integration (forbidden by
`production-first`), Batches 1–3 introduce clean domain + repository seams:

- `LessonRepository` / `QuestionRepository` interfaces.
- A `LocalPreviewLessonRepository` that serves a small, linguistically-correct,
  **clearly-labeled preview** content set (Japanese + Vietnamese), surfaced in
  the UI with an explicit "preview content" marker and documented here.
- When a real backend lands, only the repository implementation is swapped;
  screens and providers stay unchanged.

This is an allowed temporary implementation (local provider behind an
interface), not fake backend success. No fabricated analytics, no fake progress.

## Batch plan

Each batch is small, reviewable, and independently verified. A batch may only
start when the previous batch is green.

### Batch 1 — Learn + Daily Lesson
- **Scope:** Replace Learn placeholder with a production Learn hub: daily-lesson
  entry, lesson categories/sections, continue-learning card, lesson list →
  lesson detail. Loading/empty/error states. Preview content clearly labeled.
- **New seams:** `lesson` feature (domain, data preview repo, presentation),
  `LessonRepository`, providers, routes (`/learn/lesson/:id`).
- **Exit criteria:** Learn hub renders real preview lessons with all states;
  lesson detail opens; preview labeling present; i18n vi+ja; tests added.
- **Verification:** `flutter analyze`, `flutter test`.
- **Manual QA:** Learn tab, lesson open/back, dark mode, small screen, long JA.
- **Dependencies:** none (foundation for Batches 2–3).

### Batch 2 — Question Player Core
- **Scope:** BJT-style question player: scenario/prompt, answer options, select
  state, submit/check, correct/incorrect feedback, navigation to explanation.
  Optimized for long Japanese text. Reading-assist suppressed during answering.
- **New seams:** `QuestionRepository`, question domain, question player screen +
  controller, route (`/learn/lesson/:id/practice`).
- **Exit criteria:** Player runs a preview question set end-to-end; selection +
  check + result transitions work; states handled; i18n; tests.
- **Verification:** `flutter analyze`, `flutter test`.
- **Dependencies:** Batch 1 (lesson entry points).

### Batch 3 — Explanation Result
- **Scope:** Explanation result screen: correct answer, user answer, explanation,
  business-manner point, vocabulary/phrases when present. JA/VI layout.
  Save-for-later (add to flashcards) when architecture allows.
- **Exit criteria:** Explanation renders for a question; correct/user answers
  distinguished; reading help revealed post-answer; i18n; tests.
- **Verification:** `flutter analyze`, `flutter test`.
- **Dependencies:** Batch 2.

### Batch 4 — Review Hub
- **Scope:** Replace Review placeholder with a real Review Hub: review entry
  points (flashcards = real; saved questions / mistakes / weak points =
  honest empty/preview where no data source exists yet). Link existing
  flashcards. Empty states.
- **Exit criteria:** Hub lists review modes; flashcards link works; honest
  states for not-yet-available data; i18n; tests.
- **Verification:** `flutter analyze`, `flutter test`.
- **Dependencies:** Batches 1–3 desirable (saved-question linkage) but not
  blocking; flashcards already exist.

### Batch 5 — Flashcard / SRS Polish
- **Scope:** Polish existing flashcard deck list + review for dark mode and
  production mobile UX; JA/VI typography; safe gesture/touch improvements only.
  No functional regressions.
- **Exit criteria:** Flashcard flow visually consistent in light/dark, all
  states intact, existing tests still pass + new widget coverage where useful.
- **Verification:** `flutter analyze`, `flutter test`.
- **Dependencies:** none (independent polish).

### Batch 6 — Progress Analytics
- **Scope:** Replace Progress placeholder with a production progress screen using
  **only real available data** (deck counts, reviewable cards, offline sync).
  Honest empty/preview state where no analytics source exists. Weak-point
  sections only if backed by data.
- **Exit criteria:** Progress shows real metrics + honest empty state; no fake
  streaks; i18n; tests.
- **Verification:** `flutter analyze`, `flutter test`.
- **Dependencies:** none.

### Batch 7 — Settings Polish
- **Scope:** Proper mobile Settings experience (currently reuses Profile).
  Preserve profile functionality. Add app theme-mode setting if feasible
  without overengineering; language/preferences entries.
- **Exit criteria:** Settings screen distinct, profile preserved, theme-mode
  persists (if added), i18n; tests.
- **Verification:** `flutter analyze`, `flutter test`.
- **Dependencies:** none.

### Batch 8 — Offline / Connectivity UX
- **Scope:** Wire `OfflineBanner` to real connectivity state if a stable
  mechanism exists without a heavy new dependency; otherwise keep
  presentational and document. Offline states where relevant.
- **Exit criteria:** Connectivity surfaced honestly; no unjustified dependency;
  tests where feasible.
- **Verification:** `flutter analyze`, `flutter test`.
- **Dependencies:** none.

### Batch 9 — Accessibility + Responsive Polish
- **Scope:** Audit all screens: text overflow, small-screen layout, touch
  targets, semantics labels, dark-mode consistency, large `textScaler`.
- **Exit criteria:** No overflow at 320 dp; targets ≥ 48 dp; semantics on key
  controls; tests where useful.
- **Verification:** `flutter analyze`, `flutter test`.
- **Dependencies:** Batches 1–8 (audits their output).

### Batch 10 — Final Production QA Cleanup
- **Scope:** Review every screen against `MOBILE_SCREEN_CHECKLIST.md`; remove
  dead code + clearly-unused l10n keys; ensure no fake production data; update
  docs.
- **Exit criteria:** Checklist satisfied; docs current; final verification green.
- **Verification:** `flutter analyze`, `flutter test`, `flutter build apk --debug`
  if the environment allows.
- **Dependencies:** all prior batches.

## Manual QA notes

Every batch is hand-checked (or widget-tested) at 320 dp and a large width, in
light and dark, in vi and ja, with long Japanese and Vietnamese strings. See
`MOBILE_MANUAL_QA_CHECKLIST.md` for the full scenario list.

## Dependencies summary

```
Batch 1 ──> Batch 2 ──> Batch 3 ──┐
                                   ├─> Batch 4
Batch 5 (independent)              │
Batch 6 (independent)              │
Batch 7 (independent)              │
Batch 8 (independent)              │
                                   v
                        Batch 9 (audits 1–8) ──> Batch 10 (final)
```
