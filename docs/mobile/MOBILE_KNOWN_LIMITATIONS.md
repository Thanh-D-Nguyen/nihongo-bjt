# NihonGo BJT — Mobile Known Limitations (Phase 02)

Honest, single-source list of what is **not** done, **not** verifiable here, or
**deliberately deferred** in the Phase 02 mobile build. Keep this current; do not
let limitations hide in code comments.

Companion docs: `MOBILE_AI_QA_REPORT.md`, `MOBILE_BATCH_LOG.md`,
`MOBILE_MANUAL_QA_CHECKLIST.md`.

---

## 1. Content & backend integration

- **Home is now feature-entry parity, not full web-widget parity.** The 2026-06-03 Home rebuild surfaces real mobile routes and real local/provider data, but intentionally omits or routes around web-only widgets such as personalized feed, weekly server report, ads, push prompt, focus timer, companion pet, mystery box, login bonus, and battle. These need dedicated mobile contracts/product decisions before appearing as Home widgets. Full per-widget blockers are tracked in `HOME_WEB_PARITY_AUDIT.md`.
- **Home hero greeting is device-clock based, not server-personalized.** Web shows a server greeting plus a due-review count from `/api/daily/home`; mobile has no daily-home client, so the hero shows a real time-of-day greeting (derived from the device clock, localized vi/ja) and the real *cards ready* total. The due-today SRS count is omitted rather than guessed — wiring it needs a `/flashcards/due` client + runtime backend.
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

## 6a. Deck & flashcard management (web parity)

- **Code-complete with full vertical wiring, not device-verified.** Deck
  create/edit/archive, card list search/sort, single-card add/edit/delete, and
  per-deck review are implemented against the **real** canonical API contracts
  (`PATCH /api/flashcards/decks/:id` for full-set card writes,
  `GET /api/flashcards/reviews/due?deckId=` for per-deck review). They pass
  `analyze` + widget/unit tests but were not exercised on a running build (no
  device available here). Use `MOBILE_DECK_FLASHCARD_RETEST_CHECKLIST.md`.
- **Card writes resend the FULL card set.** The backend replaces every card link
  when `cards` is present, so a single add/edit/delete reposts the whole deck.
  Existing `cardId`/`deckCardId` are preserved to keep shared cards + SRS rows.
  A concurrent edit on another device can therefore be overwritten last-write-
  wins; there is no optimistic-concurrency token in the contract.
- **Ownership is not in the `DeckDetail` domain.** Edit/archive/card-management
  actions render for every deck the learner can open (own + public). The server
  enforces owner-only and rejects non-owner writes; that error surfaces via
  SnackBar rather than the action being hidden client-side.
- **OfflineBanner for deck management stays DEFERRED.** There is still no live
  connectivity / cache-served signal (see §3), so no offline indicator is shown
  for deck/card screens. Not faked.
- **Integration flow added but not run here.** `integration_test/app_flows_test.dart`
  now includes a Flashcards → deck detail → add-card flow; it compiles
  (`flutter analyze integration_test` clean) but `flutter test integration_test`
  requires a connected device/emulator, which is unavailable on this host.

## 6b. App shell / bottom navigation (2026 redesign)

- **Five compact destinations: Home, Learn, Review, Search, Me.** The shell was
  rebuilt around a Material 3 `NavigationBar` (phones) / `NavigationRail`
  (≥600 dp tablets) sharing one `AppDestination` list. Lookup tools (Dictionary,
  Kanji, Grammar, Saved) and the global search field now live under the **Search**
  tab; account/preferences/progress/billing live under the **Me** tab. Verified by
  `analyze` + `flutter test` only — not visually confirmed on a device.
- **Moved routes keep working via prefix redirects.** `_legacyPathRedirect`
  rewrites the old locations (`/learn/dictionary`→`/search/dictionary`,
  `/learn/kanji`, `/learn/grammar`, `/learn/saved`, `/learn/search`→`/search`,
  `/progress`→`/me/progress`, `/settings`→`/me`, `/profile`→`/me`,
  `/profile/subscription`→`/me/subscription`). External bookmarks to old paths
  rely on these redirects.
- **Active-tab follows branch ownership.** Saved opened from the Me hub switches
  to the Search tab (Saved is a Search-owned route). Intentional, not a bug, but
  may surprise users; revisit if product wants Saved duplicated per tab.
- **Fullscreen flows have no bottom nav by design.** Practice, Flashcard review,
  Scenario, Exam and Career chapter render outside the shell. Confirmed
  structurally (routes sit outside `StatefulShellRoute`); on-device focus-mode
  behaviour is unverified.
- **Tablet `NavigationRail` is logic/widget-tested only.** Real foldable/tablet
  visual QA (rail spacing, extended labels ≥900 dp, content max-width cap) still
  needs a human eye.

## 6c. Sensory design layer (color / press feedback / haptics)

- **No UI sound effects exist, by design.** There is no audio dependency
  (`just_audio`/`audioplayers`) and no TTS in the app. The sensory layer is
  deliberately silent; a "sound" toggle would be fake, so none was added.
- **Haptics are gated and centralized but device-unverified.** All haptics go
  through `AppHaptics` (selection/light/medium), wired to a persisted
  Settings → Preferences toggle (default ON) mirrored into `AppHaptics.enabled`
  at the app root. Fired on: practice answer select + set finish, flashcard
  reveal + SRS rating + session complete, and bottom-nav tab change. Verified by
  `analyze` + `flutter test` only — actual vibration needs a physical device
  (emulators often do not buzz).
- **Press feedback (`PressableScale`) is widget-tested, not eyeballed.** Wraps
  primary/secondary buttons; suppressed when disabled/loading or when system
  Reduce Motion is ON. The subtle scale/spring feel still needs on-device QA.
- **Premium/info color roles are unverified on real panels.** `premium` (gold)
  and `info` (blue) palette roles plus the learning-state role getters resolve
  correctly in light/dark via tests, but real-panel contrast/appearance is
  unconfirmed. Correct/incorrect always pair color **+ icon + text**, never
  color alone.

## 6d. Search / Reference hub + Saved library (2026)

- **Recent searches are device-local, not cross-device.** History is stored in
  the on-device Drift DB (`recent_searches`), newest-first, de-duplicated. It
  survives app restart but does **not** sync across devices and is not exposed
  to the backend. DAO is unit-tested; UI is widget-tested.
- **Search results come only from `/api/search`.** No client-side fallback or
  fabricated rows. The kind filter is a pure client-side narrowing of the real
  result set and only appears when results span more than one kind.
- **Bookmark state on detail pages is derived from the saved list.** The
  bookmark icon reads `isSavedProvider` (derived from `savedListProvider`, i.e.
  `/api/bookmarks/*`); there is no dedicated "is this bookmarked" endpoint, so a
  signed-out learner sees the unsaved state and a sign-in prompt on tap. Toggles
  are optimistic with rollback on failure. Verified by `analyze` + widget tests
  only — not exercised against a running backend on a device.
- **Saved removal + Undo are server-authoritative** (`SavedRepository.toggle`)
  and refetch the list; the brief refetch latency means the row leaves on the
  next frame rather than instantly. Undo re-toggles via the provider container so
  it keeps working after the row is disposed.
- **Long-text + dark-mode resilience is asserted at 320 dp** for the hub, the
  results+filter list, and the Saved library
  ([test/qa/search_saved_long_text_test.dart](apps/mobile/test/qa/search_saved_long_text_test.dart)),
  but the *visual quality* of wrap/ellipsis still wants a human eye on a device.
- **Widget previews were intentionally not added.** This repo has no established
  `previews.dart` system; introducing one for these screens alone was out of
  scope. The QA + feature widget tests are the coverage.

## 6e. Exam Mode & Practice flow (web parity, 2026)

- **Exam Mode is the real web-quiz parity surface; Practice is an intentional
  local-preview aid.** Exam Mode drives the live `/api/quiz` engine (start →
  current-question → submit-answer → scored result → per-question breakdown);
  Practice runs the `LocalPreviewQuestionRepository` for self-check only and has
  no backend by design. Practice is therefore **not** a parity gap.
- **Per-question review/breakdown is now implemented** against
  `GET /api/quiz/session/:id/results/breakdown`. The review screen shows the
  score header, an All/Wrong/Correct filter, each prompt, the learner's chosen
  option, a correct/incorrect verdict, and the Vietnamese explanation.
- **The review never renders a "correct answer" string.** The breakdown contract
  intentionally omits the correct-option text post-session, so the UI shows only
  the honest verdict + explanation — it does **not** fabricate the right answer.
- **Listening (audio) questions show a calm "audio unavailable on mobile" note**
  and direct the learner to the readable prompt/scenario. There is no audio/TTS
  dependency in the app, so a player would be fake; none was added. When a
  question carries `audioUrl` the note appears above the prompt.
- **Save-to-flashcards from review is DEFERRED — no backing endpoint.** There is
  no `POST /api/flashcards/add-from-remediation` (only `cards/from-content`,
  `cards/suggest`, review/deck routes exist), so a save button would be fake. The
  review surfaces skill/section chips + explanation only.
- **Active-session resume is not wired.** Leaving Exam Mode mid-session ends the
  client flow; there is no `GET /quiz/session/active` resume on mobile yet. The
  server session may still be open server-side; revisit when product needs
  cross-launch resume.
- **Haptics fire on exam option select (selection), submit (light), and finish
  (medium)** via `AppHaptics`, matching Practice/flashcards. Device-unverified
  like all haptics (see §6c).
- **Verified by `analyze` + `flutter test` only.** Exam start/submit/result/
  review and the audio note were not exercised against a running backend on a
  device. Use `EXAM_PRACTICE_RETEST_CHECKLIST.md`.

## 7. What the automated tests do NOT prove

- Pixel-level visual correctness, color on real panels, shadow/blur appearance.
- Scroll physics, keyboard avoidance, overscroll glow.
- Performance, jank, cold-start, memory.
- Haptics, system back gesture, app-switch resume, deep links.
- Font fallback for Japanese glyphs on specific OEM devices.

---

These limitations are **safe-to-ship-for-review** caveats, not blockers for the
code itself: `analyze` is clean and all 418 tests pass. They are the precise set
of things a human must confirm once a device is available.
