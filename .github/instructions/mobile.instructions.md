---
applyTo: "apps/mobile/**"
---

# Mobile (Flutter) — Production Engineering Rules

These rules govern every change inside `apps/mobile`. They are mandatory, not
aspirational. The mobile app is a first-class product, not a web clone.

## Stack (do not change without justification)

- Flutter (stable channel) + Dart, Material 3.
- State / DI: `flutter_riverpod`.
- Routing: `go_router` (declarative, `StatefulShellRoute` for the tab shell).
- Local persistence: `drift` (SQLite). Encrypted secrets: `flutter_secure_storage`.
- Networking: `http` via `core/api/api_client.dart`.
- Localization: gen-l10n from `lib/l10n/*.arb` (`ja`, `vi`). Vietnamese is the
  default audience locale.
- Lints: `very_good_analysis` (strict). `flutter analyze` must stay clean.

Do not add a new dependency unless it is (a) clearly needed, (b) stable and
well-maintained, and (c) justified in the change summary. Prefer the SDK and
the packages already in `pubspec.yaml`.

## Design tokens (single source of truth)

All visual constants come from `lib/core/theme`:

- Colors: `AppColors` (raw brand constants) + `AppPalette` (theme-aware
  semantic roles, read via `context.palette`).
- Typography: `AppTypography` (Latin/Vietnamese + dedicated Japanese tokens).
- Spacing: `AppSpacing`. Radius: `AppRadius`. Shadows: `AppShadows`.
- Motion: `AppMotion`.

Never hardcode hex colors, raw pixel paddings, durations, or radii in a widget
when a token exists. If a token is missing, add it to the token file first.

## Every screen must handle every state

For any screen that loads or mutates data, implement all applicable states:

- **Normal** (data present)
- **Loading** (`LoadingStateView` / shimmer matching content shape — never a
  bare spinner on a blank screen)
- **Empty** (`EmptyStateView` — encouraging, with a clear next action)
- **Error** (`ErrorStateView` — gentle, actionable, with retry)
- **Offline / network failure** (`OfflineBanner` when connectivity is relevant)

## Theming & accessibility

- Every screen supports **light and dark** mode (driven by `ThemeMode.system`).
  Read colors from `context.palette` / `Theme.of(context).colorScheme` — never
  from hardcoded light-only constants.
- Every screen is **SafeArea-aware**.
- Every screen is **responsive**: usable on small phones (320–360 dp) and large
  phones / foldables. No fixed widths that overflow. Guard against text overflow
  (`maxLines` + `TextOverflow.ellipsis`, or wrap/scroll).
- All tappable controls have a **minimum 48×48 dp** touch target.
- Respect `MediaQuery.textScaler`; do not lock font sizes that clip at large
  scales.
- Meet WCAG AA contrast in both themes.

## Typography for Japanese & Vietnamese

- Japanese running text uses the Japanese tokens (`japaneseBody` etc.) with
  line-height ≥ 1.8 so kanji/kana never feel cramped. Never shrink Japanese for
  visual effect.
- Vietnamese text must not clip diacritics — keep adequate line-height (≥ 1.5)
  and avoid tight fixed-height containers around Vietnamese strings.
- Reading help (furigana/kana) renders through `JapaneseText` and respects the
  reading-assist policy (hidden during active exam/recall).

## Localization

- No user-facing string literals in widgets. Every visible string goes through
  the generated `AppLocalizations` (add keys to **both** `app_vi.arb` and
  `app_ja.arb`, then regenerate). Vietnamese must read naturally; Japanese must
  be linguistically correct — no machine-translation artifacts.

## Components, not copy-paste

- Reuse the shared widgets in `lib/shared/widgets` (`AppScaffold`, `AppCard`,
  `PrimaryButton`, `SecondaryButton`, `AppChip`, `SectionHeader`, state views,
  `OfflineBanner`, `LearningProgressCard`). If you are about to copy UI, extract
  a reusable widget instead.
- Keep files focused and small. Split large widget files by responsibility.

## UI direction

Premium but calm; learner-focused; 2026-modern. No noisy gradients, no
unreadable glass/blur, no distracting animation, no neon. Motion is purposeful
(150–300 ms) and respects `prefers-reduced-motion` (`MediaQuery.disableAnimations`).

## Verification before "done"

- Run `flutter analyze` (must be clean) and `flutter test` (must pass).
- State exactly which commands ran and their result. If a command cannot run,
  say which one and why — do not claim completion.
- Report the exact files changed.

## No fake completion

- No placeholder data styled to look like real backend-integrated data unless
  it is clearly marked as a preview/mock in the UI.
- No silently swallowed errors. No TODO standing in for a required behavior.
- Do not modify backend/API/database from the mobile app task unless strictly
  required and called out.
