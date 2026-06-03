# NihonGo BJT — Android Device UI/UX QA Report

Date: 2026-06-03  
Tester role: senior mobile QA / UI-UX reviewer  
Scope: Android UI/UX QA for the Flutter app in `apps/mobile`

## Final verdict

**Not ready for beta.**

Reason: physical Android real-device QA is still blocked, and emulator QA found
P1 blockers in both core practice and flashcard review flows.

This report includes real emulator inspection evidence, but it is **not** a
physical-device sign-off.

## Environment / device info

| Item | Result |
| --- | --- |
| Host | macOS 26.5 25F71, darwin-arm64 |
| Flutter | 3.44.1 stable |
| Dart | 3.12.1 |
| Android SDK | 36.0.0 at `/Users/thanhnguyen/Library/Android/sdk` |
| ADB | Android Debug Bridge 1.0.41, platform-tools 37.0.0-14910828 |
| Physical Android device | **Not available** |
| Emulator tested | `sdk_gphone64_arm64`, `emulator-5556` |
| Emulator Android version | Android 16 / API 36 |
| Emulator screen | 1440 x 3040 physical pixels |
| App path | `apps/mobile` |
| Requested path note | The prompt referenced `mobile`; this repo uses `apps/mobile` |

## Commands run

| Command | Result |
| --- | --- |
| `flutter doctor -v` | Completed. Android toolchain OK. Xcode warning only: CocoaPods 1.15.2 out of date. |
| `adb version` | Completed. ADB 1.0.41 / platform-tools 37.0.0. |
| `adb devices` | Completed. Only `emulator-5556 device`; no physical Android device. |
| `cd apps/mobile && flutter devices` | Completed. Android emulator, macOS, Chrome, and wireless iPhone detected; no physical Android device. |
| `cd apps/mobile && flutter analyze` | Passed. `No issues found!` |
| `cd apps/mobile && flutter test` | First attempt failed due to a Flutter startup-lock conflict from parallel execution; rerun sequentially passed all 166 tests. |
| `cd apps/mobile && flutter build apk --debug` | Passed. Built `build/app/outputs/flutter-apk/app-debug.apk`. |
| `cd apps/mobile && flutter run -d emulator-5556` | Passed. App installed and launched on emulator. |
| `adb shell cmd uimode night yes` | Passed. Dark mode applied and Home was inspected. |

## Login result

**Passed on emulator.**

The local account provided by the user was used only at runtime. Credentials are
not stored in source code, docs, screenshots, or the report. Login returned to
Home successfully.

Related evidence:

- `docs/mobile/device-qa-screenshots/01-login-emulator.png`
- `docs/mobile/device-qa-screenshots/19-login-result-emulator.png`

## Screens actually tested on emulator

| Screen / flow | Status | Notes |
| --- | --- | --- |
| First launch / auth | Tested on emulator | App initially opened authenticated Home from cached state. After logout flow, Login appeared and local account login succeeded. |
| Login | Tested on emulator | Layout professional, readable, keyboard/IME accessory visible. Login succeeded. |
| App shell / bottom navigation | Tested on emulator | Labels fit in Vietnamese. State preservation works, but branch highlighting is confusing for Flashcards. |
| Home | Tested on emulator | Clear hierarchy, readable Vietnamese/Japanese, good light/dark rendering. |
| Learn | Tested on emulator | Preview state is clearly labeled; cards readable. |
| Lesson Detail | Tested on emulator | Japanese/Vietnamese readability good. Practice CTA clear but icon is visually ambiguous. |
| Question Player / Practice | Tested on emulator | Readability good; core flow blocked at Question 2 because enabled Next did not advance after repeated taps. |
| Explanation Result | Not reached | Blocked by P1 practice Next issue. |
| Review Hub | Tested on emulator | Clear, honest counts and CTAs. |
| Flashcards / SRS | Partially tested on emulator | Deck list opened; review screen opened; Reveal answer CTA did not respond after repeated taps. |
| Progress | Tested on emulator | Honest empty state, good readability. |
| Settings / Profile | Tested on emulator | Coherent settings; account screenshot redacted. Logout transition is confusing before redirect. |
| Offline / network behavior | Not tested | No airplane/network toggle pass performed. |
| Small-screen / high-risk layout | Not physically tested | Emulator width is large/high-density. Existing automated 320dp tests passed, but no physical narrow-device pass occurred. |
| Dark mode | Partially tested on emulator | Home inspected in system dark mode. Other screens not fully dark-mode inspected manually. |

## Screens not tested and why

| Screen / flow | Status | Exact reason |
| --- | --- | --- |
| Physical Android device pass | Not tested | No physical Android device connected or authorized. |
| Explanation Result | Not tested | Practice flow stuck at Question 2 on emulator. |
| Full Flashcard/SRS grading flow | Not tested | Reveal answer CTA did not respond on emulator. |
| Offline / network behavior | Not tested | Not performed in this emulator pass. |
| Large font/display size | Not tested | Not performed in this emulator pass. |
| Japanese locale end-to-end | Not tested | Vietnamese UI only in this pass, except Japanese learning content. |

## UI/UX score table

Scale: 1 = poor, 5 = excellent. `N/T` = not tested manually.

| Screen | Visual hierarchy | Typography/readability | Spacing/rhythm | Interaction clarity | Navigation clarity | Dark mode quality | Production polish | BJT suitability |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Login | 4 | 4 | 4 | 4 | 4 | N/T | 4 | 4 |
| App shell | 4 | 4 | 4 | 3 | 3 | 4 on Home | 3 | 4 |
| Home | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 |
| Learn | 4 | 4 | 4 | 4 | 4 | N/T | 4 | 4 |
| Lesson Detail | 4 | 5 | 4 | 4 | 4 | N/T | 4 | 5 |
| Question Player | 4 | 5 | 3 | 2 | 3 | N/T | 2 | 4 |
| Explanation Result | N/T | N/T | N/T | N/T | N/T | N/T | N/T | N/T |
| Review Hub | 4 | 4 | 4 | 4 | 4 | N/T | 4 | 4 |
| Flashcards / SRS | 4 | 5 | 4 | 2 | 3 | N/T | 2 | 4 |
| Progress | 4 | 4 | 4 | 4 | 4 | N/T | 4 | 4 |
| Settings / Profile | 4 | 4 | 4 | 3 | 3 | N/T | 3 | 3 |

## Issue list

### P0

#### ID: ANDROID-QA-P0-001

* **Severity:** P0
* **Screen/route:** QA environment / all Android routes
* **Device:** No physical Android device connected. Android emulator
  `emulator-5556` was used only for emulator QA.
* **Android version:** Physical device unknown. Emulator observed as Android 16
  / API 36.
* **Theme/language:** Not applicable to physical-device pass.
* **Steps to reproduce:**
  1. Run `adb devices`.
  2. Run `cd apps/mobile && flutter devices`.
  3. Observe that no physical Android device appears.
* **Expected:** At least one physical Android device appears as `device`, with
  USB debugging authorized, so the app can be installed and visually inspected.
* **Actual:** Only Android emulator `emulator-5556` is available. No physical
  Android device is connected or authorized.
* **Evidence:**
  * Screenshot path: none.
  * Log excerpt:

    ```text
    List of devices attached
    emulator-5556	device
    ```

* **UX impact:** Blocks requested real-device QA. Physical tap comfort, panel
  contrast, OEM font fallback, system back gesture, keyboard behavior, haptics,
  performance, and dark-mode rendering remain unverified on hardware.
* **Suggested fix direction for Copilot:** Do not change app code for this
  issue. Connect a physical Android phone/tablet, enable Developer Options and
  USB debugging, authorize the host, then rerun
  `flutter run -d <physical-device-id>`.
* **Acceptance criteria:**
  * `adb devices` lists a non-emulator Android device as `device`.
  * `cd apps/mobile && flutter devices` lists the same physical device.
  * `cd apps/mobile && flutter run -d <physical-device-id>` launches the app.
  * Screenshots are captured under `docs/mobile/device-qa-screenshots/`.
  * This report is updated with actual physical-device scores and issues.
* **Test recommendation:** Repeat the full manual Android QA checklist on the
  physical device in Vietnamese and Japanese, light and dark mode.

### P1

#### ID: ANDROID-QA-P1-001

* **Severity:** P1
* **Screen/route:** Practice / `/learn/lesson/:id/practice`
* **Device:** Android emulator `sdk_gphone64_arm64`
* **Android version:** Android 16 / API 36
* **Theme/language:** Light mode, Vietnamese UI, Japanese learning content
* **Steps to reproduce:**
  1. Log in.
  2. Open Learn.
  3. Open daily lesson `敬語の基本`.
  4. Tap `Luyện tập (3 câu)`.
  5. Select an answer on Question 1.
  6. Tap `Tiếp theo`; Question 2 appears.
  7. Select an answer on Question 2.
  8. Tap the enabled `Tiếp theo` button repeatedly.
* **Expected:** Tapping enabled `Tiếp theo` advances to Question 3.
* **Actual:** The button appears enabled but repeated taps did not advance from
  Question 2 during emulator QA.
* **Evidence:**
  * Screenshot path:
    `docs/mobile/device-qa-screenshots/12-practice-next-stuck-emulator.png`
  * Relevant log excerpt: no Flutter exception printed during the tap attempts.
* **UX impact:** Blocks the core practice flow and prevents reaching the
  Explanation Result screen.
* **Suggested fix direction for Copilot:** Inspect `PracticePage` sticky action
  layout and hit testing around the bottom action area. Check whether the
  scrollable content, SafeArea, bottom navigation shell, or overlay absorbs taps
  after Question 2 selection. Keep the fix scoped; do not redesign practice.
* **Acceptance criteria:**
  * On emulator and physical Android, selecting an answer on every question
    enables `Tiếp theo`/`Hoàn thành`.
  * Tapping the enabled CTA advances immediately.
  * A full 3-question run reaches the result/explanation review.
  * Widget/integration coverage verifies Q1 → Q2 → Q3 → result with real
    button taps.
* **Test recommendation:** Add a device/integration-style test for the complete
  practice flow, including a tall question/options layout and sticky CTA.

#### ID: ANDROID-QA-P1-002

* **Severity:** P1
* **Screen/route:** Flashcard review / `/flashcards/:deckId/review`
* **Device:** Android emulator `sdk_gphone64_arm64`
* **Android version:** Android 16 / API 36
* **Theme/language:** Light mode, Vietnamese UI, Japanese card content
* **Steps to reproduce:**
  1. Log in.
  2. Open Review Hub.
  3. Tap `Ôn flashcard`.
  4. Open the `ビジネス基礎` deck.
  5. Tap `Hiện đáp án` repeatedly.
* **Expected:** The card reveals the answer and shows SRS rating buttons.
* **Actual:** The `Hiện đáp án` button did not reveal the answer during emulator
  QA after repeated taps.
* **Evidence:**
  * Screenshot path:
    `docs/mobile/device-qa-screenshots/23-flashcard-review-revealed-emulator.png`
  * Relevant log excerpt: no Flutter exception printed during tap attempts.
* **UX impact:** Blocks the SRS review loop and prevents grading cards.
* **Suggested fix direction for Copilot:** Inspect hit testing and layout in
  `FlashcardReviewPage`, especially the primary button area, bottom inset, and
  interaction with the global bottom navigation shell.
* **Acceptance criteria:**
  * Tapping `Hiện đáp án` reveals the back of the card on emulator and physical
    Android.
  * Rating buttons appear and can grade at least one card.
  * Completion summary is reachable.
  * Regression test covers reveal → grade → next card.
* **Test recommendation:** Add a focused widget/integration test that uses the
  same visible CTA text to reveal the answer and grade a card.

### P2

#### ID: ANDROID-QA-P2-001

* **Severity:** P2
* **Screen/route:** Practice / `/learn/lesson/:id/practice`
* **Device:** Android emulator `sdk_gphone64_arm64`
* **Android version:** Android 16 / API 36
* **Theme/language:** Light mode, Vietnamese UI
* **Steps to reproduce:**
  1. Open a practice question with at least three options.
  2. Observe the bottom of the viewport before scrolling.
* **Expected:** All visible options and the primary CTA have sufficient space;
  the active practice flow should reduce distractions.
* **Actual:** The global bottom navigation remains visible during active
  practice, and the sticky action area partially obscures lower options.
* **Evidence:**
  * Screenshot paths:
    `docs/mobile/device-qa-screenshots/05-practice-question-emulator.png`,
    `docs/mobile/device-qa-screenshots/07-practice-question2-emulator.png`
* **UX impact:** Makes the core BJT practice experience feel less focused and
  makes option discovery harder on a phone-sized viewport.
* **Suggested fix direction for Copilot:** Consider making practice a full-screen
  focus route or ensure the bottom action area reserves enough scroll padding.
  Keep navigation/back behavior explicit.
* **Acceptance criteria:**
  * Practice options are never hidden behind sticky actions or bottom nav.
  * Learner can see that more options exist without guessing.
  * Back navigation still returns to lesson detail.
* **Test recommendation:** Add a widget test that pumps a tall prompt/options
  list and verifies the last option can scroll above the CTA.

#### ID: ANDROID-QA-P2-002

* **Severity:** P2
* **Screen/route:** Flashcards / `/flashcards`
* **Device:** Android emulator `sdk_gphone64_arm64`
* **Android version:** Android 16 / API 36
* **Theme/language:** Light mode, Vietnamese UI
* **Steps to reproduce:**
  1. Open Review Hub.
  2. Tap `Ôn flashcard`.
  3. Observe bottom navigation active state on the Flashcard deck list.
* **Expected:** The active nav state matches the learner's mental model. If
  Flashcards is launched from Review, Review should remain visually active or
  the route should clearly explain the context.
* **Actual:** Flashcard deck list shows the Home tab as active because the route
  is nested under the Home branch.
* **Evidence:**
  * Screenshot path:
    `docs/mobile/device-qa-screenshots/21-flashcard-decks-emulator.png`
* **UX impact:** Navigation feels inconsistent: the learner enters from Review
  but the shell says Home.
* **Suggested fix direction for Copilot:** Revisit shell branch ownership for
  Flashcards. Prefer placing flashcard review under the Review branch or hiding
  bottom nav during focused SRS.
* **Acceptance criteria:**
  * Entering Flashcards from Review does not highlight Home unexpectedly.
  * Back behavior remains predictable.
  * Existing Home CTA to flashcards still works.
* **Test recommendation:** Add route/navigation tests for Home → Flashcards and
  Review → Flashcards active tab state.

#### ID: ANDROID-QA-P2-003

* **Severity:** P2
* **Screen/route:** Settings/Profile sign-out
* **Device:** Android emulator `sdk_gphone64_arm64`
* **Android version:** Android 16 / API 36
* **Theme/language:** Light mode, Vietnamese UI
* **Steps to reproduce:**
  1. Open Settings.
  2. Tap `Đăng xuất`.
  3. Observe the immediate screen state.
* **Expected:** The app transitions clearly to Login, or shows a clear
  signing-out/loading state before redirect.
* **Actual:** The profile briefly remained inside the shell with fallback
  learner identity and disabled sign-out before a later navigation surfaced
  Login.
* **Evidence:**
  * Screenshot path:
    `docs/mobile/device-qa-screenshots/25-logout-transient-profile-emulator.png` shows the
    transient post-logout profile state captured before Login appeared.
* **UX impact:** The learner may think logout failed or the profile is broken.
* **Suggested fix direction for Copilot:** Make sign-out state explicit and
  redirect immediately when auth becomes unauthenticated. Avoid showing fallback
  profile data inside an authenticated shell after sign-out.
* **Acceptance criteria:**
  * Tapping sign-out gives immediate progress feedback or redirects to Login.
  * No authenticated shell/profile fallback remains visible after sign-out
    completes.
  * Sign-out cannot leave the user in an ambiguous disabled state.
* **Test recommendation:** Add an auth redirect test for Settings sign-out.

#### ID: ANDROID-QA-P2-004

* **Severity:** P2
* **Screen/route:** Test infrastructure / drift-backed screens
* **Device:** Host test environment, not Android runtime
* **Android version:** Not applicable
* **Theme/language:** Not applicable
* **Steps to reproduce:**
  1. Run `cd apps/mobile && flutter test`.
  2. Observe the Drift debug warning during tests.
* **Expected:** Test output is clean aside from known third-party tooling
  warnings, or the multiple-database warning is intentionally suppressed with a
  documented reason.
* **Actual:** Tests pass, but Drift prints a warning that `AppDatabase` was
  created multiple times with the same executor during tests.
* **Evidence:**
  * Log excerpt:

    ```text
    WARNING (drift): It looks like you've created the database class AppDatabase multiple times.
    ```

* **UX impact:** No direct user-facing impact proven. It is a quality risk
  because database lifecycle warnings can hide real persistence issues.
* **Suggested fix direction for Copilot:** Audit test/provider database
  lifecycle. Ensure each test has an isolated executor/container teardown, or
  suppress only with a documented test-only reason.
* **Acceptance criteria:** `flutter test` passes without this warning, or the
  warning is intentionally suppressed in test setup only.
* **Test recommendation:** Add/adjust provider-container teardown tests around
  `appDatabaseProvider`.

### P3

#### ID: ANDROID-QA-P3-001

* **Severity:** P3
* **Screen/route:** Lesson Detail / Practice CTA
* **Device:** Android emulator `sdk_gphone64_arm64`
* **Android version:** Android 16 / API 36
* **Theme/language:** Light mode, Vietnamese UI
* **Steps to reproduce:**
  1. Open Learn.
  2. Open `敬語の基本`.
  3. Inspect the `Luyện tập (3 câu)` CTA.
* **Expected:** CTA icon communicates practice/question clearly.
* **Actual:** The icon reads like a small boxed question/error glyph at this
  size and does not feel premium.
* **Evidence:**
  * Screenshot path:
    `docs/mobile/device-qa-screenshots/04-lesson-detail-emulator.png`
* **UX impact:** Minor polish issue; text remains clear.
* **Suggested fix direction for Copilot:** Swap to a clearer Material icon such
  as quiz/school/play-style practice icon, using existing icon patterns.
* **Acceptance criteria:** CTA remains accessible, localized, and visually
  clearer at phone scale.
* **Test recommendation:** Visual regression/manual screenshot after change.

#### ID: ANDROID-QA-P3-002

* **Severity:** P3
* **Screen/route:** Tooling / iOS plugin warning
* **Device:** Host tooling
* **Android version:** Not applicable
* **Theme/language:** Not applicable
* **Steps to reproduce:** Run `flutter analyze`, `flutter test`, or
  `flutter build apk --debug`.
* **Expected:** Tool output is free of unrelated warnings where possible.
* **Actual:** Flutter warns that `flutter_secure_storage` does not support Swift
  Package Manager for iOS and this may become an error in a future Flutter
  version.
* **Evidence:**

  ```text
  The following plugins do not support Swift Package Manager for ios:
    - flutter_secure_storage
  ```

* **UX impact:** No Android UX impact. Future iOS/tooling maintenance risk.
* **Suggested fix direction for Copilot:** Track upstream plugin support or pin
  the iOS package-management strategy. Do not block Android QA on this.
* **Acceptance criteria:** Warning resolved or tracked in known limitations.
* **Test recommendation:** Recheck after Flutter/plugin upgrades.

### P4

No P4-only visual issues filed in this pass.

## Screenshot index

Screenshots are under `docs/mobile/device-qa-screenshots/`.

| File | Description |
| --- | --- |
| `01-login-emulator.png` | Login screen before credential entry. |
| `02-home-emulator.png` | Home, light mode, authenticated cached session. |
| `03-learn-emulator.png` | Learn hub, light mode. |
| `04-lesson-detail-emulator.png` | Lesson detail with Practice CTA. |
| `05-practice-question-emulator.png` | Practice Question 1, initial state. |
| `06-practice-selected-emulator.png` | Practice Question 1 selected state. |
| `07-practice-question2-emulator.png` | Practice Question 2 with lower option partially hidden. |
| `12-practice-next-stuck-emulator.png` | Practice stuck at Question 2 after repeated Next taps. |
| `16-settings-profile-emulator.png` | Settings/Profile, account area redacted. |
| `19-login-result-emulator.png` | Login succeeded and returned to Home. |
| `20-review-hub-emulator.png` | Review Hub. |
| `21-flashcard-decks-emulator.png` | Flashcard deck list; Home tab highlighted. |
| `22-flashcard-review-front-emulator.png` | Flashcard review front state. |
| `23-flashcard-review-revealed-emulator.png` | Flashcard reveal CTA still on front state after tap. |
| `24-home-dark-emulator.png` | Home, dark mode. |
| `25-logout-transient-profile-emulator.png` | Ambiguous post-logout fallback profile state. |

## Recommended fix order

1. Fix `ANDROID-QA-P1-001` Practice Next stuck.
2. Fix `ANDROID-QA-P1-002` Flashcard reveal stuck.
3. Fix practice layout focus/obscured lower option (`ANDROID-QA-P2-001`).
4. Fix Flashcards branch/nav ownership ambiguity (`ANDROID-QA-P2-002`).
5. Fix logout transition ambiguity (`ANDROID-QA-P2-003`).
6. Clean up Drift warning if it is not a known harmless test-only pattern.
7. Address P3 polish/tooling warnings.
8. Rerun emulator QA, then repeat on a physical Android device.

## Verification summary

Automated gates:

- `flutter analyze`: passed.
- `flutter test`: passed, 166 tests.
- `flutter build apk --debug`: passed.

Manual emulator QA:

- Login succeeded.
- Home, Learn, Lesson Detail, Review Hub, Flashcard deck list, Progress,
  Settings/Profile, and Home dark mode were visually inspected.
- Practice result and Flashcard grading were not reached because of P1 blockers.

Physical Android QA:

- Still blocked. No physical Android device was connected.
