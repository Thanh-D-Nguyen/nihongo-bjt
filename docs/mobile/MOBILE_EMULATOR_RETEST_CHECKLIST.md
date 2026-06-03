# NihonGo BJT — Mobile Emulator Retest Checklist

Targeted retest for the 2026-06-04 Copilot fix pass. Those fixes are **code +
automated tests only** (`flutter analyze` clean, 174 tests pass). They are
**ready for emulator retest**, not visually confirmed. Run this on an emulator
(or physical device) to confirm the P1/P2 findings are actually resolved before
marking them passed.

Companion docs: `MOBILE_DEVICE_UIUX_QA_REPORT.md` (findings + fix-pass section),
`MOBILE_KNOWN_LIMITATIONS.md`, `MOBILE_MANUAL_QA_CHECKLIST.md`.

> Do **not** mark any screen passed unless you actually observed the behavior on
> the running app. Check each step in **light and dark**.

## Setup

- [ ] `cd apps/mobile && flutter run -d <emulator-or-device-id>` launches the
      app cleanly.
- [ ] Locale = Vietnamese and Japanese both render correctly.

## Retest steps

1. [ ] **Login with local account.** App returns to Home; no fallback/flash.
2. [ ] **Practice flow until Question 2.** Answer Q1, tap Next, reach Q2 as a
       middle question.
3. [ ] **Tap Next and verify advance/result.** Q2 advances to Q3 on a single
       tap; the player is never stuck with an enabled-but-dead `Tiếp theo`
       (`ANDROID-QA-P1-001`).
4. [ ] **Reach Explanation/Result.** Finish the last question and confirm the
       result summary renders with real selections.
5. [ ] **Open Flashcards from Review.** Review tab → Flashcards opens the deck
       list; pick a deck (full-screen review is pushed).
6. [ ] **Tap Reveal answer.** `Hiện đáp án` reveals on the first tap; tapping the
       card face also reveals (`ANDROID-QA-P1-002`). Grading buttons appear.
7. [ ] **Check active bottom tab.** While browsing decks the **Review** tab
       stays highlighted — never Home (`ANDROID-QA-P2-002`).
8. [ ] **Check Practice layout for overlap.** Practice and flashcard review are
       full-screen (no bottom nav); the Next/Reveal CTA and the lower option are
       not crowded by the nav bar (`ANDROID-QA-P2-001`).
9. [ ] **Logout and confirm clean Login transition.** Settings → sign out shows
       an explicit signing-out state, then lands on Login with no broken
       fallback profile (`ANDROID-QA-P2-003`).
10. [ ] **Run light/dark checks for affected screens.** Repeat the practice,
        flashcard review, deck list, and logout screens in both themes.

## Not covered by this pass (still open)

- [ ] `LoginPage` horizontal overflow (~145px at 390px width) — logged in
      `MOBILE_KNOWN_LIMITATIONS.md`, not fixed here.
- [ ] Android debug APK build on a complete SDK (could not run on the Windows
      host used for the fix pass; validated only on the Mac previously).
- [ ] Physical-device QA — still required for sign-off.
