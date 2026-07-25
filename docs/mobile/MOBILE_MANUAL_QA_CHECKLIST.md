# NihonGo BJT — Mobile Manual QA Checklist (Phase 02)

Run this end-to-end pass before shipping the mobile learning experience. Check
each scenario in **light and dark**, at **320 dp** and a **large width**, in
**Vietnamese and Japanese**. Mark `n/a — reason` where a scenario does not
apply.

> Before starting, read `MOBILE_AI_QA_REPORT.md` (what automation already
> covered + recommended test order) and `MOBILE_KNOWN_LIMITATIONS.md` (known
> caveats so you don't re-file them as bugs).

## Global setup
- [x] Debug APK build runs on local Mac:
      `cd apps/mobile && flutter build apk --debug`.
- [ ] Physical Android device connected and authorized.
- [ ] App installed/launched on physical Android device with
      `flutter run -d <physical-device-id>`.
- [ ] System locale = Vietnamese → UI is Vietnamese.
- [ ] System locale = Japanese → UI is Japanese.
- [ ] System dark mode toggles app light/dark live.
- [ ] System large text scale does not clip any screen.

2026-06-03 device-QA note: `adb devices` detected only Android emulator
`emulator-5556`; no physical Android device was available. Real-device visual
inspection was stopped and documented in `MOBILE_DEVICE_UIUX_QA_REPORT.md`.

2026-06-03 emulator-QA note: The app launched on `emulator-5556`, login with the
local account succeeded, and several screens were inspected with screenshots.
This is not a physical-device pass. Core blockers found:
`ANDROID-QA-P1-001` Practice Next stuck and `ANDROID-QA-P1-002` Flashcard Reveal
stuck. Do not mark Practice/Explanation/Flashcard review complete until those
are fixed and retested.

2026-06-04 Copilot-fix-pass note: The P1/P2 findings were addressed in **code +
automated tests only** (`flutter analyze` clean, 174 tests pass). The app was
**not** run on an emulator or device in that pass, so the affected flows are
**ready for emulator retest**, not visually confirmed. Use
`MOBILE_EMULATOR_RETEST_CHECKLIST.md` to confirm before marking them passed. The
Android debug APK build could not run on the Windows host (incomplete Android
SDK); it remains validated only on the Mac.

## 1. First launch
- [ ] App opens to login when unauthenticated; to Home when authenticated.
- [ ] No flash of unstyled / wrong-theme content.
- [ ] SafeArea respected (notch, status bar, home indicator).

## 2. Home dashboard
- [ ] Home hero renders; primary CTA reflects real flashcard availability.
- [ ] Hero greeting matches device clock (morning/afternoon/evening/night) in vi and ja.
- [ ] Loading shows content-shaped skeleton, not a bare spinner.
- [ ] Empty state (no decks) is encouraging with a clear next action.
- [ ] Error state shows retry and recovers on retry.
- [ ] Partial-data state keeps route-backed shortcuts usable.
- [ ] Today's lesson card is honest about preview content when preview-backed.
- [ ] Review/progress metrics reflect real deck/card and device-local study data only.
- [ ] Every Home shortcut navigates to the expected route in `HOME_RETEST_CHECKLIST.md`.
- [ ] No fake streak, XP, rank, plan, ad, or recommendation count appears.

## 3. Learn flow
- [ ] Learn hub lists lesson categories/sections and a daily-lesson entry.
- [ ] Preview content is clearly labeled as preview (not presented as backend).
- [ ] Continue-learning card (if shown) is honest.
- [ ] Loading / empty / error states all render.
- [ ] Tapping a lesson opens lesson detail; back returns to the hub.

## 4. Daily lesson
- [ ] Daily-lesson entry opens the intended lesson/flow.
- [ ] Long Japanese passage is readable (line-height ≥ 1.8, no clipping).
- [ ] Vietnamese support text never clips diacritics.

## 5. Question player
- [ ] Scenario/prompt renders with long Japanese text intact.
- [ ] Answer options are tappable with ≥ 48 dp targets.
- [ ] Selecting an option shows a clear selected state.
- [x] Selecting an option shows a clear selected state on emulator.
- [ ] Submit/check is disabled until an answer is selected.
- [ ] Reading help is suppressed while answering (exam policy).
- [ ] `Tiếp theo` advances after every selected answer. **Blocked on emulator by
      `ANDROID-QA-P1-001`: Question 2 did not advance after repeated taps.**

## 6. Answer selection
- [ ] Correct answer → clear, non-punishing positive feedback.

### BJT full simulation media/result addendum (2026-07)

- [ ] Exam browser distinguishes full simulation from target practice.
- [ ] Full simulation guide states 0–800 estimated scoring and 3 BJT parts.
- [ ] Practice audio transcript is visible; official simulation transcript is
      hidden during the live session.
- [ ] Question image renders, or localized `imagePrompt` appears when missing.
- [ ] Result shows server estimated `x/800` + non-official caveat.
- [ ] Listening / Listening-Reading / Reading show real correct/total when the
      breakdown provides those section codes.
- [ ] Section-detail failure degrades inline without hiding the overall result.
- [ ] Incorrect answer → gentle feedback, correct answer shown.
- [ ] Cannot change a graded answer in a way that fakes the result.

## 7. Explanation result
- [ ] Shows correct answer, the user's answer, and the explanation.
- [ ] Business-manner point and vocabulary/phrases render when present.
- [ ] Reading help is revealed here (post-answer).
- [ ] Save-for-later / add-to-flashcards works (or is honestly absent).
- [ ] Continue advances to the next question or completes the set.

2026-06-03 emulator-QA: Not reached because Practice was blocked at Question 2.

## 8. Review flow
- [ ] Review Hub lists review modes.
- [ ] Real modes (flashcards) work; not-yet-available modes show honest states.
- [ ] No fake counts presented as real.

## 9. Flashcards
- [ ] Deck list loads with all states (loading/empty/error).
- [ ] Review session: reveal, grade (Again/Hard/Good/Easy), interval labels.
- [ ] Completion summary is accurate.
- [ ] Offline grading queues and the sync status is honest.
- [ ] Dark mode: card front/back readable, no dark-on-dark.

2026-06-03 emulator-QA: Deck list and card front opened. Review reveal/grade
flow is blocked by `ANDROID-QA-P1-002`: `Hiện đáp án` did not reveal after
repeated taps.

## 9a. Deck & flashcard management (web parity)
- [ ] Deck list filter (All / Private / Public) shows the honest subset.
- [ ] Create deck: required title validation, save → deck appears in list.
- [ ] Edit deck metadata (title/description/visibility) → persists on return.
- [ ] Archive deck: confirm dialog → deck leaves the active list.
- [ ] Deck detail: card search filters by front/back/reading.
- [ ] Deck detail: sort toggle (Position / A–Z) reorders the list.
- [ ] Add card: required front/back, max-length errors, save → card appears.
- [ ] Edit card: form prefilled, update → change persists.
- [ ] Delete card: confirm dialog → card leaves the deck.
- [ ] Study CTA launches a review session scoped to that deck's due cards.
- [ ] Owner-only actions on someone else's public deck surface a server error
      via SnackBar (no client-side crash).
- [ ] JA card front uses generous line-height; no overflow at 320 dp.

> Full per-step matrix: `MOBILE_DECK_FLASHCARD_RETEST_CHECKLIST.md`.

## 10. Progress
- [ ] Only real metrics shown; honest empty/preview state otherwise.
- [ ] No fabricated streaks or inflated numbers.
- [ ] Weak-point sections appear only when backed by data.

## 11. Settings
- [ ] Profile/identity preserved; sign-out works and returns to login.
- [ ] Language preference applies.
- [ ] Theme-mode setting (if present) persists across restart.
- [ ] Furigana preference toggles reading help app-wide.
- [ ] Haptics preference toggles app-wide vibration; persists across restart.

## 11b. Sensory feedback (color / press / haptics)
- [ ] Premium/subscription surfaces use the gold premium tone, not warning amber.
- [ ] Correct vs incorrect answers differ by color **+ icon + text**, not color alone.
- [ ] Buttons scale slightly on press; disabled/loading buttons do not scale.
- [ ] With Reduce Motion ON, press scaling and decorative motion stop.
- [ ] Haptics ON: answer select, set finish, card reveal, SRS rating, session
      complete, and tab change each give a tick (needs a physical device).
- [ ] Haptics OFF: none of the above vibrate.
- [ ] App emits **no** sound anywhere (system volume up to confirm).
- Full pass: `MOBILE_SENSORY_RETEST_CHECKLIST.md`.

## 11a. App shell navigation (5-tab redesign)
- [ ] Bottom nav shows exactly 5 tabs: Home / Learn / Review / Search / Me.
- [ ] **Search** tab is the lookup hub (Dictionary, Kanji, Grammar, Saved +
      global search); opening a tool keeps the Search tab active.
- [ ] **Me** tab aggregates profile, progress, subscription, settings, about,
      sign-out — no dead actions.
- [ ] Fullscreen flows (Practice, Flashcard review, Scenario, Exam, Career
      chapter) have **no** bottom nav and return to the launching tab.
- [ ] Legacy paths redirect (see `APP_SHELL_RETEST_CHECKLIST.md` §13).
- [ ] ≥600 dp width shows a NavigationRail instead of the bottom bar.
- Full pass: `APP_SHELL_RETEST_CHECKLIST.md`.

## 11c. Search / Reference hub + Saved (web parity)
- [ ] Idle Search hub shows the prompt + tool cards; every card routes.
- [ ] Recent searches record, re-run on tap, remove one, clear all, and survive
      an app restart (device-local). Newest-first, no duplicates.
- [ ] Search results come from `/api/search`; no fabricated rows; tapping a
      result opens the matching word/kanji/grammar detail.
- [ ] Kind filter appears only with >1 result kind; selecting narrows; changing
      the query resets to All.
- [ ] Detail bookmark icon reflects real saved state; optimistic toggle with
      rollback; signed-out tap prompts sign-in.
- [ ] Saved library remove un-bookmarks with a working Undo toast.
- Full pass: `SEARCH_RETEST_CHECKLIST.md`.

## 12. Dark mode
- [ ] Every screen is legible in dark; colors from palette, no light-only consts.
- [ ] Status colors (success/warning/danger) use dark-tuned variants.

## 13. Japanese long text
- [ ] Long Japanese passages wrap cleanly; never shrunk for layout.
- [ ] Furigana renders above terms where policy permits.

## 14. Vietnamese long text
- [ ] Long Vietnamese strings wrap or ellipsis; diacritics never clip.
- [ ] No tight fixed-height containers around Vietnamese.

## 15. Small screen (320–360 dp)
- [ ] No horizontal overflow on any screen.
- [ ] Buttons, chips, tiles reflow without clipping.

## 16. Offline / network issue
- [ ] Connectivity-relevant screens surface the offline banner or degrade
      gracefully.
- [ ] Network errors are recoverable (message + retry), never a dead end.

## 17. Back navigation
- [ ] System back and in-app back behave correctly on every screen.
- [ ] Re-tapping the active tab returns to its branch root.
- [ ] No accidental loss of in-progress state where it matters.

## 18. Accessibility / touch targets
- [ ] All interactive controls ≥ 48×48 dp.
- [ ] Meaningful semantics/labels on icon-only controls.
- [ ] Reduced-motion respected (animations drop/shorten).
- [ ] WCAG AA contrast in both themes.
- [ ] Progress bars announce a label to screen readers (TalkBack/VoiceOver).
- [ ] Selection chips announce selected state.

Automated coverage: `test/a11y/a11y_guidelines_test.dart` asserts android/iOS/
labeled tap-target + text-contrast guidelines on the shared interactive widgets
in light and dark. Reduced-motion paths use `MediaQuery.disableAnimationsOf`.

Known caveat: `SecondaryButton`'s accent-coloured label measures 3.52 contrast
(< AA 4.5) on the light surface — a palette-token follow-up; verify visually and
treat as a tracked design fix, not a blocker introduced by this phase.

## 19. Responsive / tablet & landscape
- [ ] On a tablet / large width, AppScaffold pages cap content width (~640 dp)
      and centre — no edge-to-edge line lengths.
- [ ] Phone widths (< 640 dp) still fill the width with no regression.
- [ ] Home (raw Scaffold) is acceptable at large width — known: not yet capped.
- [ ] Landscape: no overflow, controls remain reachable.
