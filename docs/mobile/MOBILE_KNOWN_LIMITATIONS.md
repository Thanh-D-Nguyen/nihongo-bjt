# NihonGo BJT — Mobile Known Limitations (Phase 02)

Honest, single-source list of what is **not** done, **not** verifiable here, or
**deliberately deferred** in the Phase 02 mobile build. Keep this current; do not
let limitations hide in code comments.

Companion docs: `MOBILE_AI_QA_REPORT.md`, `MOBILE_BATCH_LOG.md`,
`MOBILE_MANUAL_QA_CHECKLIST.md`.

---

## 1. Content & backend integration

- **Home is now feature-entry parity, not full web-widget parity.** The 2026-06-03 Home rebuild surfaces real mobile routes and real local/provider data, but intentionally omits or routes around web-only widgets such as personalized feed, weekly server report, ads, push prompt, focus timer, companion pet, mystery box, login bonus, and battle. These need dedicated mobile contracts/product decisions before appearing as Home widgets.
- **Home runtime API verification is blocked unless local Keycloak/API are running.** The Home implementation targets existing mobile repositories/routes; live API-backed destinations still need device retest with local services available.
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

- **Home tablet width cap is resolved in code/tests.** `HomePage` now centers
  content with a 640 dp cap and has widget coverage for wide tablet surfaces.
  Real tablet/foldable visual QA is still pending.
- Long-text screens were hardened this phase (meta rows / header chips now
  wrap/ellipsize), but the *visual quality* of the truncation/wrap still wants a
  human eye on a real narrow device.
- Extremely tall practice prompts push option tiles below the lazy `ListView`
  fold; scrolling to reach them is unverified on-device.
- **`LoginPage` horizontal overflow (~145px at 390 dp) is RESOLVED.** The 2026
  auth rebuild replaced the login screen with `AuthScreenShell`, whose brand
  header wraps the wordmark in a `FittedBox` and caps content at 420 dp. The
  login layout is now covered by widget tests across 320–390 dp in light/dark
  and JA ([test/features/auth/login_page_test.dart](apps/mobile/test/features/auth/login_page_test.dart)).
  Still not visually confirmed on-device — see
  `MOBILE_AUTH_RETEST_CHECKLIST.md`.

## 6. Tooling / build

- **2026-06-03 Android debug APK build now passes on the local Mac.**
  `cd apps/mobile && flutter build apk --debug` produced
  `build/app/outputs/flutter-apk/app-debug.apk`.
- **Physical Android device QA is still blocked.** `adb devices` and
  `flutter devices` detected only Android emulator `emulator-5556`; no physical
  Android phone/tablet was connected or authorized. Per the manual QA
  instructions, no real-device screen can be marked passed until a physical
  Android device is available.
- **2026-06-03 emulator QA found core mobile blockers.** Practice can get stuck
  on Question 2 with an enabled `Tiếp theo` button that does not advance, and
  Flashcard review can fail to reveal the answer after tapping `Hiện đáp án`.
  See `MOBILE_DEVICE_UIUX_QA_REPORT.md` for evidence and acceptance criteria.
- **2026-06-04 Copilot fix pass addressed those blockers in code + tests only**
  (full-screen practice/review routes outside the bottom nav, whole-card reveal
  target, deck list moved under Review, explicit signing-out view). These are
  **ready for emulator retest**, not visually confirmed. The Android debug APK
  build **could not run on the Windows host** (the configured Android SDK at
  `C:\Android\sdk` has only cmdline-tools, no platforms/build-tools); analyze +
  tests are the verifiable gates there. See
  `MOBILE_EMULATOR_RETEST_CHECKLIST.md`.
- iOS build likewise unverified here.

## 7. What the automated tests do NOT prove

- Pixel-level visual correctness, color on real panels, shadow/blur appearance.
- Scroll physics, keyboard avoidance, overscroll glow.
- Performance, jank, cold-start, memory.
- Haptics, system back gesture, app-switch resume, deep links.
- Font fallback for Japanese glyphs on specific OEM devices.

---

These limitations are **safe-to-ship-for-review** caveats, not blockers for the
code itself: `analyze` is clean and all 174 tests pass. They are the precise set
of things a human must confirm once a device is available.
