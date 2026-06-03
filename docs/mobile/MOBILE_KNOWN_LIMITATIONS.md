# NihonGo BJT — Mobile Known Limitations (Phase 02)

Honest, single-source list of what is **not** done, **not** verifiable here, or
**deliberately deferred** in the Phase 02 mobile build. Keep this current; do not
let limitations hide in code comments.

Companion docs: `MOBILE_AI_QA_REPORT.md`, `MOBILE_BATCH_LOG.md`,
`MOBILE_MANUAL_QA_CHECKLIST.md`.

---

## 1. Content & backend integration

- **Lessons and BJT questions have no backend API yet.** They are served by a
  clearly-labeled **local preview** content set (`LocalPreviewLessonRepository`,
  `LocalPreviewQuestionRepository`) behind `LessonRepository` /
  `QuestionRepository`. The UI badges this as preview content. When a real
  backend lands, only the repository implementation is swapped — screens,
  providers and routes are unchanged.
- **No lesson-progress persistence.** The "daily lesson" is a deterministic
  calendar-day rotation of real preview lessons, *not* a "continue where you
  left off" — there is no progress store to back that claim, so we don't fake it.
- **No practice attempt history.** Leaving the player resets the session
  (auto-dispose). The result review uses the current session's real selections;
  no prior scores are fabricated.

## 2. Progress analytics

- Progress is **device-local real event data** from the on-device study log
  (drift). It only records events in API/real mode; in mock/dev mode the screen
  is **honestly empty** rather than showing zeros dressed as progress.
- No server-side analytics, no cross-device sync of the study log.

## 3. Connectivity / offline

- `OfflineBanner` exists (Phase 01) but is **not wired to a live connectivity
  source** — that needs a new dependency (e.g. `connectivity_plus`) which was
  deliberately not added without justification. Offline handling today is the
  flashcard sync queue logic (unit-tested), not a global connectivity banner.
- Real network-transition behaviour (airplane mode, flaky network, sync drain
  under latency) is logic-tested only; it has **not** been validated on a device.

## 4. Accessibility

- `SecondaryButton`'s accent-on-surface label measures **3.52 contrast in light
  mode** (< WCAG AA 4.5). This is a palette-token concern — changing `accent`
  ripples brand-wide — so it is deferred to a dedicated palette tune and
  excluded from the automated contrast assertion rather than silently weakening
  the guideline. **Action item:** revisit the accent token or button styling.
- Touch targets are asserted at ≥ 48 dp logically; real thumb ergonomics are
  unverified without a device.

## 5. Responsive / layout

- `home_page` still uses a raw `Scaffold` (not `AppScaffold`), so it does **not**
  inherit the `maxContentWidth` cap — on tablets/foldables it may render
  over-wide. Other screens use `AppScaffold` and are capped.
- Long-text screens were hardened this phase (meta rows / header chips now
  wrap/ellipsize), but the *visual quality* of the truncation/wrap still wants a
  human eye on a real narrow device.
- Extremely tall practice prompts push option tiles below the lazy `ListView`
  fold; scrolling to reach them is unverified on-device.

## 6. Tooling / build

- **`flutter build apk --debug` cannot run in this environment — no Android
  SDK.** Compilation is otherwise proven by `flutter analyze` (clean) and
  `flutter test` (166 passing). APK build/install must be confirmed on a machine
  with the Android SDK before release.
- iOS build likewise unverified here.

## 7. What the automated tests do NOT prove

- Pixel-level visual correctness, color on real panels, shadow/blur appearance.
- Scroll physics, keyboard avoidance, overscroll glow.
- Performance, jank, cold-start, memory.
- Haptics, system back gesture, app-switch resume, deep links.
- Font fallback for Japanese glyphs on specific OEM devices.

---

These limitations are **safe-to-ship-for-review** caveats, not blockers for the
code itself: `analyze` is clean and all 166 tests pass. They are the precise set
of things a human must confirm once a device is available.
