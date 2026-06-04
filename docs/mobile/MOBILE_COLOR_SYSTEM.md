# Mobile Color System

Semantic color usage for the Nihongo BJT Flutter app. Screens and components
**must** read these roles via `context.palette` (the `AppPalette`
`ThemeExtension`). Never hardcode hex values in a widget. Raw brand constants
live in `lib/core/theme/app_colors.dart`; semantic roles in
`lib/core/theme/app_palette.dart`.

## Principles

- Color clarifies state and hierarchy; it is never the only signal for
  correct/incorrect (always pair with icon + text).
- Calm business-learning palette — deep navy/blue primary, teal-leaning
  secondary, restrained amber/gold accent. No neon, no random gradients, no
  aggressive red/green.
- Dark mode is hand-tuned, not inverted.

## Base roles

| Role | Token | Light | Dark |
|------|-------|-------|------|
| Background | `canvas` | `#F8FAFC` | `#0B1220` |
| Surface | `surface` | `#FFFFFF` | `#131C2E` |
| Surface elevated/hover | `surfaceHover` | `#F1F5F9` | `#1B2740` |
| Surface muted | `surfaceMuted` | `#F1F5F9` | `#1B2740` |
| Border / divider | `border` | `#E2E8F0` | `#25324C` |
| Text primary | `ink` | `#111827` | `#F1F5F9` |
| Text secondary | `inkSecondary` | `#4B5563` | `#A6B2C6` |
| Text disabled/tertiary | `inkTertiary` | `#9CA3AF` | `#6B7892` |

## Brand roles

| Role | Token | Notes |
|------|-------|-------|
| Primary | `colorScheme.primary` (navy `#1B2A4A`) | main CTA, app bar, focus learning |
| On primary | `colorScheme.onPrimary` | white |
| Accent / secondary | `accent` (`#3B82F6` / `#5B9BFF`) | links, secondary CTA, focus rings |
| Accent soft | `accentSoft` | selected chips, accent fills |

## Learning roles

Added by the sensory system. Use for learning-state surfaces and badges, paired
with icon + label.

| Role | Token | Maps to | Meaning |
|------|-------|---------|---------|
| Active | `learningActive` | accent | in-progress lesson/unit |
| Completed | `learningCompleted` | success | finished |
| Due | `learningDue` | premium (gold) | due for review |
| Weak | `learningWeak` | danger | low mastery / needs work |
| Locked | `learningLocked` | inkTertiary | not yet available |
| Recommended | `learningRecommended` | accent | suggested next |

Each has a `*Soft` background companion where it backs a surface.

## Answer roles

| Role | Mapping |
|------|---------|
| Answer neutral | `surface` + `border` |
| Answer selected | `accentSoft` fill + `accent` 2px border + check icon |
| Answer correct | `success` / `successSoft` + check icon + label |
| Answer incorrect | `danger` / `dangerSoft` + close icon + label |
| Answer explanation | `surfaceMuted` box |
| Answer disabled | `inkTertiary` on `surfaceMuted` |

Correct/incorrect must always carry an icon **and** text, never color alone.

## State roles

| Role | Token | Light | Dark |
|------|-------|-------|------|
| Success | `success` / `successSoft` | `#059669` | `#34D399` |
| Warning | `warning` / `warningSoft` | `#D97706` | `#FBBF24` |
| Error | `danger` / `dangerSoft` | `#DC2626` | `#F87171` |
| Info | `info` / `infoSoft` | `#0EA5E9` | `#38BDF8` |
| Premium / streak / achievement | `premium` / `premiumSoft` | `#B7791F` | `#E0B355` |
| Offline | use `warning` | — | — |
| Progress | use `accent` | — | — |
| Battle | use `accent` | — | — |

`premium` is a **restrained gold**, deliberately distinct from `warning` (amber)
so premium/streak no longer read as a caution state. Used sparingly: premium
upsell, streak figures, achievements.

## Dark mode rules

- Do not invert light colors — use the tuned dark roles.
- Correct/incorrect must be clear but not over-saturated (lightened, not neon).
- Premium gold must stay legible, not muddy (`#E0B355` on dark surfaces).
- Disabled state must remain visible (`inkTertiary` is lightened in dark).
- Border/divider subtle but visible (`#25324C`).
- Cards separate from background (`surface` lighter than `canvas`).

## Rules

- Do not hardcode screen colors; add a semantic token if a color is reused.
- Do not use color as the only indicator of state.
- Avoid neon, random gradients, aggressive red/green.
- Keep consistency with the web brand (navy primary, blue accent).
