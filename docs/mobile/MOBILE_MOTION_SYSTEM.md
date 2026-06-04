# Mobile Motion System

Motion tokens and usage rules for the Nihongo BJT Flutter app. Motion is
purposeful and calm — it explains state changes and gives feedback, never
decoration. Tokens live in `lib/core/theme/app_motion.dart`.

## Tokens

| Token | Duration | Use |
|-------|----------|-----|
| `instant` | 0ms | reduced-motion fallback / no animation |
| `fast` | 150ms | press feedback, small fades, chip/answer selection |
| `base` | 250ms | most state changes, flashcard reveal, page transition |
| `slow` | 400ms | result emphasis, completion moments |

Mapping to the skill's recommended ranges:

- tap/press feedback 80–120ms → `fast` (150ms, capped low end via press scale)
- chip/card selection 100–160ms → `fast`
- answer selection 120–180ms → `fast`
- flashcard reveal 180–260ms → `base`
- page transition 180–280ms → `base`
- result emphasis 280–450ms → `slow`
- loading shimmer → calm, slow (`LoadingStateView` shimmer, not distracting)

## Easing

| Curve | Token | Use |
|-------|-------|-----|
| Standard | `standard` (easeOutCubic) | entering / most transitions |
| Emphasized | `emphasized` (easeOutBack) | completion / result moments only |

Avoid bouncy motion in serious learning flows (practice, exam). Use
`emphasized` only for completion/result, never for routine state changes.

## Press feedback

A shared `PressableScale` wrapper (`lib/shared/widgets/pressable_scale.dart`)
provides a subtle scale-down on press (`0.97`, `fast` duration) for tappable
targets, honouring reduced motion. Applied to primary/secondary buttons and
the flashcard reveal target.

## Usage rules

Use motion for: button press feedback, answer selection, correct/incorrect
feedback, flashcard reveal, screen transitions, loading skeleton, expand/
collapse, progress updates, lesson complete, subtle tab transitions.

Do NOT use motion for: every card entering the screen, moving backgrounds,
confetti spam, animated gradients, animated reading text, shaking errors,
scroll-linked effects that hurt performance.

## Reduced motion

Every animation must honour reduced motion via
`MediaQuery.disableAnimationsOf(context)` — drop or shorten non-essential
animation and keep the functional state change visible without animation.
This is already the standard in the practice and flashcard flows and must be
followed for all new motion.
