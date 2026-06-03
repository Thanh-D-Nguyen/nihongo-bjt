# Copilot Prompt — Fix Mobile Android QA Issues

Read `docs/mobile/MOBILE_DEVICE_UIUX_QA_REPORT.md` first.

You are fixing issues for the NihonGo BJT Flutter mobile app under
`apps/mobile`. Work in small, verifiable batches. Do not redesign the app
broadly, do not add unrelated features, and do not modify backend/web/API/
database code for mobile QA issues unless the report explicitly proves that a
backend contract is the root cause.

Current report status:

- The latest Android QA report includes **emulator QA findings**, but is not a
  physical Android device sign-off.
- No physical Android device was connected, so physical-device QA remains
  blocked.
- Emulator QA found P1 blockers in Practice and Flashcard review.
- Automated gates passed: `flutter analyze`, `flutter test` (166 tests), and
  `flutter build apk --debug`.

Priority order:

1. Resolve P0/P1 issues first.
2. Then fix P2 production-quality issues.
3. Leave P3/P4 polish for later unless they are low-risk and in the same file
   as a higher-priority fix.

Current highest-priority issues:

- `ANDROID-QA-P1-001`: Practice Question 2 `Tiếp theo` appears enabled but does
  not advance after repeated taps on emulator.
- `ANDROID-QA-P1-002`: Flashcard review `Hiện đáp án` does not reveal the
  answer after repeated taps on emulator.
- `ANDROID-QA-P2-001`: Practice bottom nav/sticky action area reduces focus and
  partially hides lower options.
- `ANDROID-QA-P2-002`: Flashcard route highlights Home in bottom nav even when
  launched from Review.
- `ANDROID-QA-P2-003`: Logout transition can briefly show fallback profile state
  instead of a clear redirect/loading state.

Important constraints:

- Do not claim real-device UI/UX completion without launching on a physical
  Android device and inspecting the screens.
- Do not store or log user credentials.
- Do not create fake login paths or bypass production auth.
- Keep fixes concrete and scoped to the issue acceptance criteria.
- Preserve i18n: all user-facing strings must go through localization files.
- Preserve Japanese/Vietnamese readability: no cramped line heights, clipped
  diacritics, or fixed-height text containers that break long strings.
- Preserve dark mode and token-driven styling.

Verification after each fix batch:

```bash
cd apps/mobile
flutter analyze
flutter test
flutter build apk --debug
```

When physical Android hardware is available, also run:

```bash
adb devices
flutter devices
flutter run -d <physical-device-id>
```

Then perform the manual QA checklist and capture screenshots under:

```text
docs/mobile/device-qa-screenshots/
```

Required documentation updates:

- Update `docs/mobile/MOBILE_DEVICE_UIUX_QA_REPORT.md` with actual device info,
  login result, tested screens, scores, issues, screenshot index, and final
  verdict.
- Update `docs/mobile/MOBILE_KNOWN_LIMITATIONS.md` if a limitation remains.
- Update `docs/mobile/MOBILE_MANUAL_QA_CHECKLIST.md` with checked results only
  for screens actually tested.
- Do not mark untested screens as passed.

Completion standard:

- All fixed issues meet their acceptance criteria.
- Tests are updated where behavior changed.
- `flutter analyze`, `flutter test`, and `flutter build apk --debug` pass.
- Real-device claims include physical device model/Android version, route,
  theme/language, screenshots, and reproduction notes.
