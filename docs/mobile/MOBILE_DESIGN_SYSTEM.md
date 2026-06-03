# NihonGo BJT — Mobile Design System

The implemented source of truth is `apps/mobile/lib/core/theme` and
`apps/mobile/lib/shared/widgets`. This document describes the intent and the
rules; the token files are authoritative for exact values.

Direction: premium but calm, learner-focused, 2026-modern. Depth through subtle
elevation and spacing — not heavy gradients, glass, or neon. Motion is
purposeful and quiet.

## Color roles

Two layers:

- **`AppColors`** — raw brand constants that do not change with theme
  (navy, blue). Use for the brand wordmark and brand accents only.
- **`AppPalette`** — theme-aware **semantic** roles, read via `context.palette`.
  This is what screens and components use. Each role has a light and a dark
  value tuned for WCAG AA contrast.

Semantic roles (both light & dark):

| Role | Use |
| --- | --- |
| `canvas` | App background behind cards. |
| `surface` | Card / sheet background. |
| `surfaceHover` / `surfaceMuted` | Subtle raised/muted fills, skeletons. |
| `border` | Hairline separators and card borders. |
| `ink` | Primary text / icons. |
| `inkSecondary` | Secondary text. |
| `inkTertiary` | Tertiary text, captions, disabled. |
| `accent` / `accentSoft` | Interactive accent + its soft background. |
| `success` / `successSoft` | Positive status + soft background. |
| `warning` / `warningSoft` | Caution status + soft background. |
| `danger` / `dangerSoft` | Error/destructive + soft background. |

Rule: never hardcode hex in a widget. Same action type uses the same role
everywhere. Status colors are semantic, not decorative.

## Typography roles

Mapped onto Material `TextTheme` slots for Latin/Vietnamese chrome, plus
dedicated Japanese tokens in `AppTypography`:

- `headlineSmall`, `titleLarge`, `titleMedium`, `bodyMedium`, `bodySmall`,
  `labelSmall` — UI chrome and Latin/Vietnamese content.
- `japaneseDisplay` — large Japanese term (card fronts).
- `japaneseBody` — Japanese running text, line-height ≥ 1.8.
- `japaneseReading` — kana/furigana reading line.

Text color resolves from the theme (onSurface / palette roles), so type adapts
to light/dark automatically. Do not bake a light-only color into a text style.

### Japanese text rules

- Line-height ≥ 1.8 for running Japanese; never tighten for visual effect.
- Furigana/kana via `JapaneseText`, gated by the reading-assist policy
  (hidden during active recall/exam).
- Minimum comfortable size: inline term ≥ ~18sp; study-focus term large.

### Vietnamese text rules

- Line-height ≥ 1.5; never clip diacritics.
- Avoid tight fixed-height containers around Vietnamese; allow wrap or ellipsis.
- Prefer `maxLines` + `TextOverflow.ellipsis` over uncontrolled overflow.

## Spacing scale

`AppSpacing` (4 dp base): `xs 4`, `s 8`, `m 16`, `l 24`, `xl 32`. Use tokens for
all padding/margins/gaps. Keep a consistent rhythm within a row/section.

## Radius scale

`AppRadius`: `sm 8` (chips/inputs), `md 10` (buttons), `lg 14` (cards),
`xl 20` (large surfaces/sheets), `pill 999` (chips/avatars). All elements in a
visual group share a radius family.

## Elevation / shadow rules

`AppShadows.sm` is the resting card shadow (soft, low-spread). Use elevation
sparingly to imply layering; cards rest at `sm`, interactive surfaces may lift
slightly on press. No heavy drop shadows. In dark mode, prefer border + subtle
fill contrast over large shadows.

## Icon rules

- Material outlined icons by default; filled only for selected/active states.
- Icon size scales with its container: ≥ 20 dp inside a 48 dp control, 24 dp for
  standalone affordances. Never tiny icons in large touch targets.
- Icon color follows the same semantic role as its label.

## Motion rules

`AppMotion`: `fast 150ms`, `base 250ms`, `slow 400ms`; standard easing curves.
Motion is purposeful (state changes, tab transitions, press feedback), never
decorative. Respect reduced-motion (`MediaQuery.disableAnimations`): drop or
shorten non-essential animation. Max a few simultaneous animations.

## Cards (`AppCard`)

Surface fill, `lg` radius, hairline `border`, resting `sm` shadow, `l` padding
by default. The base container for grouped content. Theme-aware.

## Buttons

- **`PrimaryButton`** — filled, primary CTA (one per screen ideally), height
  ≥ 48 dp, `md` radius, optional leading icon, built-in loading state, press
  scale feedback.
- **`SecondaryButton`** — outlined/tonal, same sizing, for secondary actions.
- Both: full-width by default, clear hover/press/disabled states, focus ring.

## Chips (`AppChip`)

Pill radius, compact, optional leading icon, selectable (selected uses
`accentSoft` fill + `accent` text/border). Minimum 32 dp height but inside a
≥ 44 dp tap region when interactive.

## Progress indicators

`LearningProgressCard` for dashboard-style progress (label, value, 0–1 bar).
Use real data only; any preview must be visibly labeled as a preview/mock.
Determinate bars/rings for known progress; indeterminate only for genuine
unknown-duration loads (prefer skeletons for content loads).

## Empty / error / loading states

- **Loading:** `LoadingStateView` — content-shaped shimmer/skeletons. Never a
  bare spinner on a blank screen.
- **Empty:** `EmptyStateView` — calm icon, title, encouraging body, clear CTA.
- **Error:** `ErrorStateView` — gentle icon, title, message, retry action.
- **Offline:** `OfflineBanner` — slim, non-blocking notice when connectivity is
  relevant.

## Dark mode rules

- Driven by `ThemeMode.system`; both themes are first-class.
- Read every color from `context.palette` / `colorScheme` — no light-only
  constants in widgets.
- Dark surfaces are deep navy-tinted neutrals, not pure black; accent lightens
  for contrast; status colors use their dark-tuned variants.
- Verify contrast (AA) and that no text renders dark-on-dark.
