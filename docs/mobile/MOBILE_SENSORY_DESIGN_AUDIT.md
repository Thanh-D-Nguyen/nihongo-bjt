# Mobile Sensory Design Audit

Audit of the Nihongo BJT Flutter app (`apps/mobile`) sensory layer — color,
motion, haptics, sound, accessibility — performed before implementing the
sensory design system. Source skill: `.agents/skills/bjt-mobile-sensory-design`.

## Method

Inspected the theme layer (`lib/core/theme/*`), shared components
(`lib/shared/widgets/*`), every implemented feature screen
(`lib/features/*/presentation/*`), and existing tests (`test/*`). Searched for
hardcoded colors, haptic usage, and sound/audio usage.

## Current color system status

- **Strong foundation.** A `ThemeExtension<AppPalette>` (`app_palette.dart`)
  defines semantic roles for both light and dark, accessed via
  `context.palette`. Raw brand constants live in `app_colors.dart`.
- Screens read semantic tokens (`palette.success`, `palette.danger`,
  `palette.accent`, `palette.warning`, `*Soft` variants) consistently.
- **Only one hardcoded color** found in feature screens:
  `career/.../npc_avatar.dart` uses `Color(0xFF1B2A4A)` as a fallback for a
  dynamic per-NPC color parsed from data — legitimate, not migrated.

### Gaps

- **No dedicated learning-state roles** (active / completed / due / weak /
  locked / recommended). Screens improvise with `accent` / `warning` /
  `success`.
- **`premium` and `streak` are conflated with `warning`** (amber). The skill
  requires a restrained, distinct gold for premium/achievement/streak so it
  does not read as a caution state.
- **No `info` role.** Informational surfaces reuse `accent` or `warning`.
- **No `offline` / `progress` / `battle` semantic roles** (offline currently
  borrows `warning`; progress borrows `accent`).

## Current dark mode status

- Healthy. `AppPalette.dark` is hand-tuned navy-tinted neutrals (not inverted),
  with lightened accent/status colors. Existing tests render Progress and
  Review Hub in dark mode (`test/qa/dark_mode_render_test.dart`).
- New roles must follow the same discipline (separate dark values, AA contrast,
  premium gold must not turn muddy).

## Current motion usage

- `app_motion.dart` defines `fast` (150ms), `base` (250ms), `slow` (400ms), and
  two curves (`standard` = easeOutCubic, `emphasized` = easeOutBack).
- Used purposefully: `AnimatedContainer` for answer selection,
  `AnimatedSwitcher` for flashcard reveal, progress bars. **Reduced motion is
  already honoured** at call sites via `MediaQuery.disableAnimationsOf(context)`.
- Gaps: no named tokens for press feedback / page transition / feedback
  emphasis; no centralized press-scale wrapper, so press feedback is
  inconsistent (some buttons scale, most rely on ink only).

## Current haptic usage

- **None.** No `HapticFeedback` call anywhere in `lib/`. This is a clean slate —
  meaningful, restrained haptics can be added at key learning moments.

## Current sound/audio usage

- **No UI sound effects** and no content-audio playback wired in the mobile app
  today. There is no bundled SFX asset pipeline and no TTS/pronunciation player.
- Decision: **do not add UI sound effects or fake/placeholder audio.** Content
  pronunciation audio is documented as future work, gated on real audio assets
  / API. No silent or fake settings will be shown.

## Current accessibility risks

- Correct/incorrect already pair color with icon + text (`_VerdictTag`), so
  state is not color-only — good.
- Answer option selection pairs color with a check icon + 2px border — good.
- Risk: premium/streak sharing the `warning` hue can read as a caution to
  color-blind users. Separating `premium` resolves this.
- Reduced motion respected in flashcard/answer flows; should be the standard for
  any new motion.

## Hardcoded colors found

| File | Usage | Action |
|------|-------|--------|
| `career/.../npc_avatar.dart` | `Color(0xFF1B2A4A)` fallback for parsed dynamic color | Keep (legitimate data-driven fallback) |

No other hardcoded screen colors found.

## Inconsistent state colors

- `premium` action (`workspace_premium`) styled with `warning` in `home_page`
  and `profile_page`.
- `streak` figures styled with `warning` in home/gamification.
- Offline/sync-pending styled with `warning` in `home_page`.

## Screens with weak visual feedback

- Most buttons rely on ink-splash only; no consistent press-scale. A shared
  `PressableScale` wrapper + applying it to primary/secondary buttons and
  answer/flashcard targets will make taps feel responsive.

## Screens with too much / too little motion

- No over-animation found (no constant background motion, no confetti spam).
- Slightly under-animated: tap feedback (addressed in Batch 2).

## Screens where haptic feedback would help

- Practice: answer option selected, answer submitted.
- Result: correct/incorrect reveal.
- Flashcard review: card reveal, rating (Again/Hard/Good/Easy), session complete.
- Lesson/practice completion moments.

## Screens where sound must NOT be added

- Login, Register, all navigation, Home, lists, Settings, loading states, and
  any error state. No automatic sound anywhere.

## Recommended implementation batches

- **Batch 1 — Color:** add `info/infoSoft`, `premium/premiumSoft`, learning
  roles (`learningActive/Completed/Due/Weak/Locked/Recommended`), and migrate
  premium/streak usages off `warning`.
- **Batch 2 — Components:** `PressableScale` + `AppHaptics` helper; apply press
  feedback to buttons, chips, answer/flashcard targets.
- **Batch 3 — Learning flow:** haptics on answer select/submit, correct/incorrect
  reveal; result transition polish.
- **Batch 4 — Flashcard/SRS:** haptic on reveal + rating + complete.
- **Batch 5 — Reference/content:** calm reading surfaces, premium chip color.
- **Batch 6 — App shell:** nav selected-state haptic (selection click) gated by
  setting.
- **Batch 7 — Settings:** persisted haptics toggle wired to `AppHaptics`.
- **Batch 8 — QA docs:** retest checklist + Codex retest prompt.
