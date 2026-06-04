# Mobile Flutter Skills-Driven UI/UX Production Polish Plan

> Scope: A complete, skills-driven UI/UX production polish pass for **all
> implemented** Flutter mobile screens in `apps/mobile`. This is **not** a
> feature-invention pass. No new product surfaces, no fake data, no backend
> changes unless strictly required.

## Source of truth

- Design tokens: `apps/mobile/lib/core/theme/*`
- Shared widgets: `apps/mobile/lib/shared/widgets/*`
- Rules: `.github/instructions/mobile.instructions.md`,
  `docs/mobile/MOBILE_DESIGN_SYSTEM.md`,
  `docs/mobile/MOBILE_SCREEN_CHECKLIST.md`

## Environment (verified this session)

- Flutter `3.44.0` stable / Dart `3.12.0` (supports `@Preview` widget previews).
- `flutter analyze` → clean.
- `flutter test` → green after fixing one stale brand assertion in
  `test/features/auth/login_page_test.dart` (asserted the pre-rebrand
  `NihonGo` wordmark; the brand is now `KotobaWorks`).

## Flutter skills used

| Skill | Where applied |
| --- | --- |
| `flutter-add-widget-preview` | Core shared components + key learning/auth cards |
| `flutter-add-widget-test` | Every screen/component touched |
| `flutter-build-responsive-layout` | Auth, Home, learning core, lists/detail |
| `flutter-fix-layout-issues` | Overflow / unbounded constraints / keyboard safety |
| `flutter-add-integration-test` | Core flows (Learn→Lesson→Practice→Result, Review→Flashcards→Reveal) |
| `flutter-apply-architecture-best-practices` | Keep UI/logic/data layering intact while refactoring widgets |
| `flutter-setup-declarative-routing` | Verify go_router shell/full-screen flows (no regressions) |
| `flutter-setup-localization` | Ensure no hardcoded strings; vi/ja parity |
| `flutter-use-http-package` | Only if a polished screen needs a real data path (no fakes) |
| `flutter-implement-json-serialization` | Only if DTO gaps block a real data path |

## Batch sequence

1. **Design system + component preview foundation** — token audit vs web brand;
   widget previews (light/dark, vi/ja, long text, narrow/wide) for core shared
   components.
2. **Auth** — Login (account + Google only), Register; validation UX, keyboard
   safety, 360–390 dp, dark mode, logout transition.
3. **Home** — production dashboard; honest actions only; no fake counts.
4. **Learning core** — Learn, Lesson detail, Practice/Question Player,
   Result/Explanation; focus-mode CTA safety; integration test.
5. **Review + Flashcard/SRS** — Review Hub, deck list, flashcard review; reveal
   UX; integration test.
6. **Reference/content** — Dictionary, Kanji, Grammar, Search, Saved, News,
   Magazine, Scenarios, Career.
7. **Exam, gamification, billing, battle** — Exam mode, Rewards, Subscription
   (battle is web-only; documented as out-of-scope on mobile).
8. **App-wide responsive/layout/accessibility pass.**
9. **Integration tests for core production flows.**
10. **Final UI/UX docs + Codex/device retest package.**

## Verification after every batch

```
cd apps/mobile
flutter analyze   # must stay clean
flutter test      # must stay green
```

A batch is not "done" until both commands pass. If a batch cannot be made
green, stop and report.

## Hard rules (carried from the brief)

- No unrelated features. No fake API/data. No auth bypass. No stored
  credentials. No backend/API/DB changes unless strictly required.
- No raw Keycloak/AppAuth UX in normal login/register/logout.
- Use existing tokens/components; add a token before hardcoding.
- Add/update tests for every screen touched.
- Do not claim device QA passed unless actually run on a device/emulator.

## Out of scope / honest limitations

- **Battle** is not implemented in the mobile app (web-only). No battle UI is
  invented here.
- Device/emulator visual QA (screenshots, real login) is delivered as a
  Codex/device retest package in Batch 10, not claimed as passed by this pass.
- Google sign-in and real login require a running IdP/back end; tests use
  fakes/mocks only and never real credentials.

## Completion status (all 10 batches done)

| Batch | Scope | Outcome |
| --- | --- | --- |
| 1 | Design system + component previews | `shared_component_previews.dart` (12 previews, light/dark/vi/ja/long text) + smoke tests. |
| 2 | Auth | Live validation (`autovalidateMode.onUserInteraction`), local-only sign-out (no raw Keycloak logout page), `auth_previews.dart` (10), +12 tests. |
| 3 | Home | Fixed real 11 px shortcut-card overflow at 320 dp (`childAspectRatio` 0.88→0.78); added 320 dp ja scroll test. |
| 4 | Learning core | `learn_previews.dart` + `practice_previews.dart`; overflow already covered by `long_text_overflow_test`. |
| 5 | Review + Flashcards | Added 320 dp grading-bar overflow test (passes — no defect). |
| 6 | Reference/content | Audited 9 areas; `career_previews.dart`; flagged sizes verified intentional. |
| 7 | Exam/gamification/billing | `billing_previews.dart` (PlanCard free/premium); exam + rewards audited clean; Battle confirmed web-only. |
| 8 | App-wide responsive/a11y | `test/qa/component_responsive_test.dart` (6 components × light/dark at 320 dp). |
| 9 | Integration/core flows | `integration_test/app_flows_test.dart` (device/CI) + headless mirror `test/flows/core_flows_test.dart` (4 flows pass). |
| 10 | Final docs + retest package | This summary + `MOBILE_FINAL_UIUX_RETEST_CHECKLIST.md` + `MOBILE_FINAL_UIUX_RETEST_PROMPT_FOR_CODEX.md`. |

**Final verification:** `flutter analyze` → *No issues found!*; `flutter test`
→ *305 tests passed*; `git diff --check` → clean. Device/emulator visual QA is
delivered as a retest package (Batch 10), not claimed as passed here.
