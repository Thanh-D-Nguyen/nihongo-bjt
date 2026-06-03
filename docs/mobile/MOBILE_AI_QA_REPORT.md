# NihonGo BJT — Mobile AI QA Report (Phase 02)

Author: automated agent. Purpose: record the self-QA performed **in the absence
of manual device/emulator testing**, and to hand a human tester a precise list
of what still needs eyes-on verification.

Companion docs:
- Batch record: `MOBILE_BATCH_LOG.md`
- Human test pass: `MOBILE_MANUAL_QA_CHECKLIST.md`
- Carried risks/debt: `MOBILE_KNOWN_LIMITATIONS.md`
- Roadmap: `MOBILE_IMPLEMENTATION_ROADMAP.md`

---

## 1. Verification environment

- Flutter 3.44.0 (stable) • Dart 3.12.0, Windows host.
- `flutter analyze`: **No issues found.**
- `flutter test`: **166 tests passed** (was 156 before this QA pass; +10).
- `flutter build apk --debug`: **could not run — no Android SDK in this
  environment.** This is the single check that requires real tooling we do not
  have here. `analyze` + `test` are the authoritative gates used instead.

---

## 2. Screens implemented (Phase 02, all batches complete)

| Screen | Source | States covered | Tests |
| --- | --- | --- | --- |
| Learn hub | `features/learn/.../learn_page.dart` | normal/loading/empty/error, light+dark, long text | `learn_page_test`, `qa/long_text_overflow_test`, `qa/dark_mode_render_test` |
| Lesson detail | `features/learn/.../lesson_detail_page.dart` | normal/loading/error/not-found, light+dark, long text | `qa/long_text_overflow_test` |
| Question player | `features/practice/.../practice_page.dart` | normal/loading/empty/error, gated nav, light+dark, long text | `practice_page_test`, `qa/long_text_overflow_test` |
| Explanation / result review | `features/practice/.../result_question_card.dart` | verdicts + per-question explanation | `practice_page_test` |
| Review hub | `features/review/.../review_hub_page.dart` | per-section loading/empty/error, light+dark | `review_hub_page_test`, `qa/dark_mode_render_test` |
| Flashcard deck list + review | `features/flashcards/...` | normal/loading/empty/error, reveal/rate | flashcard `*_test` suite |
| Progress analytics | `features/progress/.../progress_page.dart` | normal/loading/empty/error, light+dark | `progress_page_test`, `qa/dark_mode_render_test` |
| Settings / profile | `features/settings/.../profile_page.dart` | id-token render, language, sign-out | `profile_page_test` |
| Home dashboard | `features/home/.../home_page.dart` | normal/loading/empty/error, sync CTA | `home_page_test` |

Content honesty: lesson/question content is a **clearly-labeled local preview**
set behind `LessonRepository` / `QuestionRepository` (no fake backend). Progress
is device-local real event data (honestly empty in mock/dev mode). No fabricated
analytics or streaks anywhere.

---

## 3. Automated checks performed this pass

1. **Long Japanese text resilience** — pumped Learn hub, Lesson detail and
   Practice player with a ~190-char unbroken kanji/kana run on a 320 dp screen,
   asserted no `RenderFlex` overflow / layout assertion (light + dark).
2. **Long Vietnamese text resilience** — same screens with a ~240-char Vietnamese
   run with full diacritics; asserted no overflow and (for plain-text fields)
   that diacritics rely on wrap, not fixed-height clipping.
3. **Small-screen layout** — 320 dp logical width surface for the long-text
   suite (worst-case narrow phone).
4. **Dark-mode rendering** — pumped Progress (populated + empty) and Review hub
   (populated + empty) under the real `AppTheme.dark` so `context.palette`
   resolves to the dark palette; asserted no theming/layout exception.
5. **Primary action reachability** — Practice option tap is exercised when a
   tile is on-screen; the existing `practice_page_test` already asserts the
   full answer → score → review flow and the "Next gated until answered" rule.
6. **Route/navigation smoke** — covered by the pre-existing `app_shell_test` and
   `auth_redirect_test`; lesson → practice route wiring covered by feature tests.
7. **State coverage** — loading/empty/error views remain asserted per screen by
   the existing feature test suites (unchanged, still green).

---

## 4. Tests added / updated

- **Added** `apps/mobile/test/qa/long_text_overflow_test.dart` (6 cases).
- **Added** `apps/mobile/test/qa/dark_mode_render_test.dart` (4 cases).
- No existing tests needed changes; all 156 prior tests still pass.

## 5. Bugs found and fixed by this pass

The long-text suite surfaced **3 genuine overflow defects** that only appear with
long localized content on a narrow screen — exactly the class of bug a human
tester would catch on-device:

1. Learn daily-lesson hero meta row overflowed (`learn_page.dart`) → meta chips
   wrapped in `Flexible` + ellipsis-safe label.
2. Lesson list card meta row overflowed (`lesson_card.dart`) → level label
   wrapped in `Flexible` + `maxLines: 1` ellipsis.
3. Lesson detail header chip row overflowed (`lesson_detail_page.dart`) →
   `Row` + `Spacer` converted to a wrapping `Wrap`.

All three are now covered by regression tests.

---

## 6. What CANNOT be verified without real device testing

- Actual pixel rendering / visual polish (truncation vs. wrap *looks*, shadow
  depth, blur, color on a real panel, dark-mode contrast in daylight).
- Touch ergonomics and real tap-target comfort (tests assert ≥ 48 dp logically,
  not thumb feel).
- Scroll physics, momentum, overscroll glow, and keyboard avoidance.
- Real connectivity transitions (airplane mode, flaky network, sync drain under
  real latency) — only the logic is unit-tested; `OfflineBanner` is unwired.
- Font fallback for Japanese glyphs on specific OEM devices.
- System large-text-scale at extreme settings on a real device.
- Performance / jank, cold-start time, memory.
- APK build + install (no Android SDK here).
- Haptics, system back gesture, app-switch resume, deep links.

---

## 7. Visual / UX risks to check manually later

- Long-content screens now *wrap/ellipsize*; confirm the chosen truncation reads
  well and nothing important is hidden (especially lesson meta + header chips).
- Dark mode: confirm the populated Progress bento grid, the 7-day bar chart, and
  the SRS rating breakdown have adequate contrast and don't look muddy.
- `SecondaryButton` accent-on-surface label measures 3.52 contrast in light mode
  (< WCAG AA 4.5) — see `MOBILE_KNOWN_LIMITATIONS.md`; verify legibility.
- `home_page` still uses a raw `Scaffold` (no max-content-width cap) — check it
  on a tablet/foldable for over-wide layout.

## 8. Suspected weak spots

- Practice player with an *extremely* tall prompt: option tiles sit below the
  lazy list fold — confirm scrolling reaches and selects them on-device.
- Reading-assist furigana line wrap with very long readings (kana strings).
- Any screen relying on `MediaQuery.textScaler` at 1.8–2.0× — spot-check clipping.
- Connectivity/offline UX is logic-only; the banner is not yet shown on real
  network loss.

---

## 9. Recommended manual QA order (highest risk first)

1. **Learn → Lesson detail → Practice → Result** end-to-end (light + dark,
   320 dp + large width, VI + JA). This is the most newly-built path.
2. **Long-content stress**: open the longest lesson, switch to Japanese, max
   system text scale — watch the meta rows / header chips that were just fixed.
3. **Progress** populated vs. empty in dark mode (chart + bento contrast).
4. **Review hub** populated vs. empty, both CTAs route correctly.
5. **Home** dashboard + sync CTA on a tablet (max-width caveat).
6. **Flashcard** reveal/rate loop + offline queue behaviour on a real network.
7. **Settings/profile** language switch + sign-out.
8. Back-navigation, app resume, and accessibility/touch targets across the app.

Full step-by-step is in `MOBILE_MANUAL_QA_CHECKLIST.md`.
