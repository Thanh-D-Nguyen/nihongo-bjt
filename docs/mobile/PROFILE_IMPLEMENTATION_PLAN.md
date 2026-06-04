# Profile / Me Hub — Implementation Plan

Batched plan to rebuild the mobile Profile into a production-grade Me Hub.
Verification gate after every batch: `flutter analyze` + `flutter test` must be
green. Stop on red.

## File map

New / changed under `apps/mobile/lib`:

- `features/settings/domain/app_theme_option.dart` — **new** enum (system/light/dark).
- `features/settings/domain/user_settings.dart` — add `themeOption`.
- `features/settings/data/user_settings_repository.dart` — persist `theme_mode`.
- `features/settings/presentation/settings_controller.dart` — `setThemeOption`, `themeModeProvider`.
- `app/app.dart` — wire `themeMode: ref.watch(themeModeProvider)`.
- `features/settings/presentation/profile_page.dart` — Me Hub restructure (split into widgets; keep ≤ ~600 lines/file, extract section widgets).
- `features/settings/presentation/widgets/` — **new** extracted Me Hub widgets:
  - `me_hub_hero.dart` (hero + plan badge)
  - `me_hub_learning_snapshot.dart`
  - `me_hub_settings_group.dart` (language/theme/furigana/haptics)
  - `me_hub_support_group.dart` (help/terms/privacy/version)
- `core/config/app_environment.dart` — expose brand URLs (terms/privacy/help) if not present.
- `l10n/app_vi.arb` + `l10n/app_ja.arb` — new keys (theme, snapshot, support, plan badge).
- `pubspec.yaml` — add `url_launcher` (external links) if approved.

Tests under `apps/mobile/test`:

- `features/settings/profile_page_test.dart` — extend.
- `features/settings/me_hub_*_test.dart` — new widget tests.

## Batch 1 — Me Hub visual structure

- Restructure `ProfilePage` into the 8 sections (hero, identity, snapshot,
  quick actions, settings group, subscription group, support/about, logout).
- Extract section widgets into `presentation/widgets/`.
- Static UI first (snapshot/badge can render placeholders wired in Batch 2).
- Gate: analyze + test.

## Batch 2 — Wire real data/API

- Hero plan badge ← `subscriptionProvider` (badge only on real data; hidden on
  loading/error).
- Learning snapshot ← `studySummaryProvider` (streak / today / 7-day / total);
  honest empty state.
- App version ← `appPackageInfoProvider` (already real).
- No fabricated metrics. Gate: analyze + test.

## Batch 3 — Settings / profile actions

- Add Theme setting (enum + persistence + provider + `MaterialApp` wiring).
- Group Language / Theme / Furigana / Haptics.
- Subscription group → `Routes.subscription`.
- Support/About: Help / Terms / Privacy (external launch) + version. Omit rows
  whose URL is unconfigured (no dead rows).
- Gate: analyze + test.

## Batch 4 — Auth / logout UX

- Per `PROFILE_AUTH_LOGOUT_AUDIT.md`, behavior already correct. Verify the new
  layout preserves the signing-out state and no fallback flash. Add tests.
- Gate: analyze + test.

## Batch 5 — UI/UX polish

- 360–390 dp safe, tablet cap (`maxWidth: 720`), dark mode, VI/JA long text,
  ≥ 48 dp touch targets, `active:scale` + hover/focus rings via tokens.
- Gate: analyze + test.

## Batch 6 — Tests + retest docs

- Widget tests: hero + plan badge (real/none), snapshot (real/empty), settings
  rows route, theme/language persist, version row, logout signing-out + redirect.
- Navigation tests for quick actions.
- Add widget preview(s) for the Me Hub.
- Write `PROFILE_RETEST_CHECKLIST.md` + `PROFILE_RETEST_PROMPT_FOR_CODEX.md`.
- Gate: analyze + test + `git diff --check` + optional `flutter build apk --debug`.

## Hard rules (every batch)

- No fake profile/progress/subscription data. No dead rows. No auth bypass.
- No stored credentials. No backend changes unless strictly required.
- VI + JA l10n updated together. Tokens only. Files ≤ ~600 lines (split).
