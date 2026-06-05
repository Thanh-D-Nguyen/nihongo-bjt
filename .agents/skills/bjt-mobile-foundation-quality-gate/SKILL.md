---
name: bjt-mobile-foundation-quality-gate
description: The shared production-quality baseline for every Nihongo BJT Flutter mobile screen and feature. Use as the cross-cutting reference (states, i18n vi/ja, accessibility, dark mode, design tokens, Japanese/Vietnamese typography, verification) that all other bjt-mobile-* skills build on. Reference this skill instead of repeating the same baseline rules; domain skills only add their feature-specific parts.
---

# BJT Mobile Foundation & Quality Gate Skill

Use this skill as the **single shared baseline** for any change inside
`apps/mobile`. Every other `bjt-mobile-*` skill assumes these rules and only
adds its feature-specific behavior on top. When a domain skill says "follow the
foundation baseline", it means this file.

Authoritative companions (read them, do not duplicate them):
- `.github/instructions/mobile.instructions.md` — engineering rules (mandatory).
- `docs/mobile/MOBILE_DESIGN_SYSTEM.md` — design system.
- `docs/mobile/MOBILE_SCREEN_CHECKLIST.md` — per-screen done checklist.

## Goal

Make every mobile screen production-grade from the first commit: correct on real
data, complete in every state, localized, accessible, themed, tokenized, and
verified. No demo patterns, no fake completion.

## Stack guardrails (do not drift)

- Flutter stable + Dart, Material 3.
- State/DI: `flutter_riverpod`. Routing: `go_router` (`StatefulShellRoute`).
- Local persistence: `drift`. Secrets: `flutter_secure_storage`.
- Networking: `http` via `core/api/api_client.dart`.
- Localization: gen-l10n from `lib/l10n/*.arb` (`vi` default, `ja`).
- Lints: `very_good_analysis`. `flutter analyze` must stay clean.
- Add a dependency only if clearly needed, stable, and justified in the summary.

## Every screen must handle every state

For any screen that loads or mutates data, implement all that apply:
- **Normal** — data present.
- **Loading** — `LoadingStateView` / shimmer matching content shape. Never a
  bare spinner on a blank screen.
- **Empty** — `EmptyStateView`, encouraging, with a clear next action.
- **Error** — `ErrorStateView`, gentle, actionable, with retry.
- **Offline / network failure** — `OfflineBanner` / graceful degradation when
  connectivity is relevant.

## Design tokens (single source of truth)

All visual constants come from `lib/core/theme`:
- Colors: `AppColors` + theme-aware `AppPalette` (`context.palette`).
- Typography: `AppTypography` (Latin/Vietnamese + Japanese tokens).
- Spacing `AppSpacing`, radius `AppRadius`, shadow `AppShadows`, motion `AppMotion`.

Never hardcode hex, raw paddings, durations, or radii when a token exists. If a
token is missing, add it to the token file first.

## Components, not copy-paste

Reuse `lib/shared/widgets` (`AppScaffold`, `AppCard`, `PrimaryButton`,
`SecondaryButton`, `AppChip`, `SectionHeader`, state views, `OfflineBanner`,
`LearningProgressCard`). If about to copy UI, extract a reusable widget instead.
Keep files focused and small.

## Theming & accessibility

- Light **and** dark mode (`ThemeMode.system`); colors from `context.palette` /
  `colorScheme`, never light-only constants.
- SafeArea-aware. Responsive on 320–360 dp small phones up to large/foldables.
- No fixed widths that overflow; guard text overflow (`maxLines` + ellipsis or
  wrap/scroll).
- All tappable controls ≥ 48×48 dp.
- Respect `MediaQuery.textScaler`; do not lock sizes that clip at large scale.
- Respect reduced-motion (`MediaQuery.disableAnimations`). Max ~3 simultaneous
  animations. Motion is purposeful, 150–300 ms.
- Meet WCAG AA contrast in both themes. Never use color as the only state signal.

## Japanese & Vietnamese typography

- Japanese running text uses Japanese tokens (`japaneseBody` etc.) with
  line-height ≥ 1.8. Never shrink Japanese for layout reasons.
- Vietnamese text: line-height ≥ 1.5; never clip diacritics; avoid tight
  fixed-height containers.
- Reading help (furigana/kana) renders through the reading-assist layer and
  respects the exam-mode gating policy.

## Localization

- No user-facing string literals in widgets. Every visible string goes through
  generated `AppLocalizations`. Add keys to **both** `app_vi.arb` and
  `app_ja.arb`, then regenerate. Vietnamese natural, Japanese linguistically
  correct — no machine-translation artifacts.

## Server-authoritative data (production-first)

- PostgreSQL is the source of truth; `drift` is a cache, never the canonical
  store for domain data.
- No localStorage/in-memory hacks for state that belongs server-side.
- Entitlement/quota/premium state comes only from the server contract. No
  hardcoded `isPremium` branches in widgets.
- No fake counts, fake streaks, fake progress, fake premium, fake analytics.

## Vertical-slice definition of done

A mobile feature is done only when it has:
- typed model + API client contract (reuse the web contract where it exists),
- real persistence or an explicit provider abstraction,
- validation + error handling (no swallowed errors),
- auth/RBAC/entitlement boundary where relevant,
- i18n keys (vi + ja) for all copy,
- all applicable states implemented,
- tests for core logic and key widget behavior,
- no dead routes/cards and no placeholder styled as real data.

## Parity-audit convention

When porting a web feature, produce a parity audit doc under `docs/mobile/`
named `<FEATURE>_WEB_PARITY_AUDIT.md` with, per web feature:
web file/route · API/client/model · mobile status (Done / Partial / Missing /
Not applicable / Blocked-with-proof) · mobile UX decision · priority (P0–P3) ·
test plan. Do not mark "Missing/Blocked" unless the repo was searched and the
blocker is documented.

## Verification before "done"

- Run `cd apps/mobile && flutter analyze` (must be clean).
- Run `cd apps/mobile && flutter test` (must pass; add/update tests).
- `git diff --check`.
- Manually verify (or widget-test) at 320 dp and a large width, in light **and**
  dark, in **vi** and **ja**.
- State exactly which commands ran and their results. If one cannot run, say
  which and why — never claim completion without evidence.

## Report

List exact files changed, verification commands + results, and any known
limitations or follow-ups. No false "done".
