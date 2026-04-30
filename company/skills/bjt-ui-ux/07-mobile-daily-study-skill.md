# Mobile Daily Study UX Skill

## When to Use

Use for learner mobile layouts, daily hub, flashcards, quiz, reading assist, profile/progress, and public share pages.

## Required Checks

- Primary action is reachable on small screens.
- Text and buttons fit at 375px width.
- Japanese text remains readable.
- Tap targets are large enough.
- Sticky controls do not cover content.
- Keyboard/focus behavior is predictable.
- Offline/slow/degraded states are honest.
- Session can resume after interruption.

## Mobile Patterns

- Study card: stable height, clear next/review action.
- Quiz: fixed answer area, no layout jump on selection.
- Reading assist: bottom sheet on mobile, popover on desktop.
- Progress: compact summary first, drill-down below.

## Anti-Patterns

- Desktop table squeezed onto mobile.
- Tiny furigana or cramped line height.
- Hover-only help.
- Modals that trap mobile users.
- Sticky bars hiding answer options.

## Output Checklist

- 375px behavior checked
- tap/focus behavior checked
- Japanese readability checked
- resume/degraded state named

