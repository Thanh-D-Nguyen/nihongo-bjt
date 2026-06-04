# Mobile Widget Preview Plan

> Uses the Flutter Widget Previewer (`@Preview` from
> `package:flutter/widget_previews.dart`, available on Flutter 3.44 / Dart 3.12).
> Previews live next to the widget they exercise, in `*_previews.dart` files, so
> they never ship in a release path that requires them and stay discoverable.
>
> Launch: in VS Code open the **Flutter Widget Preview** tab, or run
> `flutter widget-preview start` from `apps/mobile`.

## Preview conventions

- One `*_previews.dart` per component family (e.g.
  `lib/shared/widgets/previews/buttons_previews.dart`).
- Each preview wraps the widget in the real app theme via a shared
  `previewWrap(...)` helper so light/dark and locale are realistic.
- Cover, where feasible: **light + dark**, **VI + JA**, **long text**, and
  **narrow (320 dp) + wide (600 dp)** constraints using the `@Preview(size:)`
  parameter and `MultiPreview` brightness variants.
- Previews are render-only; they must not call native plugins, `dart:io`, or hit
  the network (previewer runs in a web environment). Use static sample data
  clearly labeled as preview content.

## Batch 1 — core shared components

| Component | File | Preview variants |
| --- | --- | --- |
| `AppScaffold` | `shared/widgets/previews/scaffold_previews.dart` | light/dark, with/without app bar |
| `AppCard` | `shared/widgets/previews/card_previews.dart` | light/dark, short/long body |
| `PrimaryButton` | `shared/widgets/previews/buttons_previews.dart` | light/dark, enabled/loading/disabled, JA label |
| `SecondaryButton` | `shared/widgets/previews/buttons_previews.dart` | light/dark, enabled/disabled |
| `AppChip` | `shared/widgets/previews/chips_previews.dart` | light/dark, selected/unselected, JA label |
| `SectionHeader` | `shared/widgets/previews/section_header_previews.dart` | light/dark, with action |
| `LoadingStateView` | `shared/widgets/previews/state_views_previews.dart` | light/dark |
| `EmptyStateView` | `shared/widgets/previews/state_views_previews.dart` | light/dark, long copy |
| `ErrorStateView` | `shared/widgets/previews/state_views_previews.dart` | light/dark |
| `OfflineBanner` | `shared/widgets/previews/state_views_previews.dart` | light/dark |
| `LearningProgressCard` | `shared/widgets/previews/progress_card_previews.dart` | light/dark, 0% / mid / 100% |

## Batch 2+ — feature components (added as each batch lands)

| Component | File | Variants |
| --- | --- | --- |
| Auth input + buttons (`AuthPrimaryButton`, `GoogleSignInButton`, `authInputDecoration`) | `features/auth/presentation/widgets/previews/auth_previews.dart` | light/dark, VI/JA, narrow |
| Lesson / learning card | `features/learn/presentation/widgets/previews/*` | light/dark, long JA/VI |
| Answer option card (practice) | `features/practice/presentation/widgets/previews/*` | light/dark, default/selected/correct/incorrect, long JA |
| Flashcard card (front/back) | `features/flashcards/presentation/widgets/previews/*` | light/dark, JA front / VI back, long text |

## Verification

Previews are render-only and are **not** a substitute for widget tests. Every
previewed component must also have at least one `flutter_test` widget test
asserting structure/behavior. Verify the package still builds:

```
cd apps/mobile
flutter analyze
flutter test
```

## Previews shipped

| File | Group | Components |
| --- | --- | --- |
| `lib/shared/widgets/previews/shared_component_previews.dart` | Shared | 12 core shared widgets (buttons, card, chip, header, states, banner, scaffold). |
| `lib/features/auth/presentation/widgets/previews/auth_previews.dart` | Auth | headline, inputs, buttons, divider, footer, banners (10). |
| `lib/features/learn/presentation/widgets/previews/learn_previews.dart` | Learn | `LessonCard` default + long. |
| `lib/features/practice/presentation/widgets/previews/practice_previews.dart` | Practice | `QuestionOptionTile` + `ResultQuestionCard` states. |
| `lib/features/career/presentation/widgets/previews/career_previews.dart` | Career | `NpcAvatar` + `CareerSkillBar`. |
| `lib/features/billing/presentation/widgets/previews/billing_previews.dart` | Billing | `PlanCard` free/current + premium/recommended. |

Every preview file has a matching smoke test under `test/.../previews/` that
pumps each preview and asserts no exception. Full-screen, provider-bound, or
private widgets (Home, Review, flashcard review faces, exam/rewards tabs) are
intentionally **not** previewed — they are covered by screen-level widget tests.
