# Visual Review Gate

## Purpose

Keep learner/admin UI production-grade, accessible, and focused for BJT learning.

## Required When

- learner UI route changes
- admin page layout changes
- onboarding, quiz, flashcard, dashboard, search, media, social, or monetization UI changes
- any visual state could affect trust, focus, or comprehension
- phase-end approval for UI-changing phases, together with `company/gates/browser-phase-review-gate.md`

## Checklist

- Desktop and mobile layouts are checked.
- No text overlap, clipping, or unreadable truncation.
- Loading, empty, error, permission, and success states are present.
- UI text uses i18n keys.
- Color contrast is acceptable.
- Motion/audio/video does not distract or autoplay disruptively.
- Reduced-motion and accessibility expectations are respected.
- Japanese reading assist remains available where required.
- Visual hierarchy supports focused study, not noisy engagement.
- Postcards/share screens do not expose private data.
- No nested card-heavy or marketing-like layout for operational admin tools.

## Evidence

Acceptable evidence:

- screenshot review notes
- Playwright screenshot path
- manual viewport checklist with routes and states
- documented blocker if the environment cannot run UI

For phase approval, prefer Browser Phase Review evidence from `company/BROWSER_PHASE_REVIEW_POLICY.md`.

## Output

```yaml
visual_review_gate:
  status: pass | pass_with_risks | block | not_applicable
  routes_checked:
    - route
  viewports:
    - desktop
    - mobile
  findings:
    - none
```
