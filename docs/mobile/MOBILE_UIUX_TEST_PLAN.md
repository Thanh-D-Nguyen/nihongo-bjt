# Mobile UI/UX Test Plan

> Tests are the verification contract for this polish pass. Every screen or
> component touched gets at least one widget test; core flows get an integration
> test. Tests use **fakes/mocks only** — never real credentials, never the real
> network or IdP.

## Test layers

1. **Widget tests** (`test/...`) — render + interaction + state coverage for a
   single screen/component. Fast, run in CI on every change.
2. **QA hardening tests** (`test/qa/...`) — cross-cutting: narrow-width overflow
   (320–390 dp), dark-mode render, long JA/VI text. Extended in Batch 8.
3. **Integration tests** (`integration_test/...`) — end-to-end production flows
   on a host/emulator with mocked data. Added in Batches 4, 5, 9.

## Standard widget-test matrix (per screen)

For each screen that loads/mutates data, assert:

- **Narrow width** 320 / 360 / 375 / 390 dp → `tester.takeException()` is null
  (no overflow).
- **Dark mode** renders (no dark-on-dark, no exception).
- **States**: loading (skeleton), empty (`EmptyStateView`), error
  (`ErrorStateView` + retry), normal — using provider overrides.
- **Localization**: renders under `Locale('vi')` and `Locale('ja')` without
  overflow.
- **Interaction**: primary action fires; inputs validate and clear on edit;
  password toggle; no dead buttons.

## Per-batch test deliverables

| Batch | New / updated tests |
| --- | --- |
| 1 | Shared component widget tests confirmed/extended (`state_views_test`, buttons, chips, cards); previews added (render-only). |
| 2 | Auth: narrow-width, dark, JA, validation-clears-on-edit, password toggle, Google gated, register validation, logout transition, no-extra-buttons. |
| 3 | Home: narrow/dark/long-text, every shortcut navigates or shows honest unavailable state, no fake counts. |
| 4 | Learn / Lesson / Practice / Result widget tests; **integration**: Learn → Lesson → Practice → Result. |
| 5 | Review / deck list / flashcard reveal widget tests; **integration**: Review → Flashcards → Reveal. |
| 6 | Dictionary/Kanji/Grammar/Search/Saved/News/Magazine/Scenarios/Career list+detail widget tests; empty/error/offline. |
| 7 | Exam player (timer/CTA), Rewards (real data), Subscription (no fake entitlement) widget tests; **integration**: exam flow. |
| 8 | Extend `test/qa/*` overflow + dark + long-text across high-risk screens. |
| 9 | Integration: login validation, home navigation, settings→logout, register validation, dictionary/search, auth guard. |

## Commands

```
cd apps/mobile
flutter analyze                      # lint/type — must be clean
flutter test                         # widget + qa tests — must be green
flutter test integration_test        # integration (host/emulator)
git diff --check                     # whitespace/conflict markers
```

## Acceptance gate

- `flutter analyze` clean.
- `flutter test` green (0 failing).
- No screen touched without an accompanying test.
- No fake data dressed as real; no dead buttons; no raw Keycloak/AppAuth UX in
  normal login/register/logout.

## Final results (this pass)

- `flutter analyze` → **No issues found!**
- `flutter test` → **305 tests passed** (widget + qa + flows; excludes
  `integration_test/`, which requires a connected device).
- `git diff --check` → clean.
- New test assets: `test/qa/component_responsive_test.dart` (12),
  `test/flows/core_flows_test.dart` (4 headless core flows),
  `integration_test/app_flows_test.dart` (same 4 flows for device/CI), plus
  preview smoke tests for learn/practice/career/billing.
- Device/emulator visual QA is delivered as a retest package
  (`MOBILE_FINAL_UIUX_RETEST_CHECKLIST.md` +
  `MOBILE_FINAL_UIUX_RETEST_PROMPT_FOR_CODEX.md`), not claimed as passed here.
