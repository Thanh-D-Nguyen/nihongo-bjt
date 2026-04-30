# UI Production Gate

## Purpose

A UI task is production-ready only when structure, data states, accessibility, localization, and review evidence are complete enough for real users.

## Structure

- Page header exists when page-level route.
- Primary action is clear.
- Layout has clear hierarchy.
- Desktop/tablet/mobile responsive behavior is defined.
- Existing design system patterns are reused.
- For learner or learning-operation UI, BJT design direction is defined.
- Open Design BJT design direction is named for admin or learner UI.

## Data States

- Loading state.
- Empty state.
- Error state.
- Degraded or partial-data state where API can partially fail.
- Permission denied state.
- Feature disabled state if gated.
- Stale/freshness state for metrics or operational data.

## UX

- Labels are human-readable.
- Raw technical keys are hidden.
- i18n keys are used.
- Copy is clear and natural.
- No unintended mixed language.
- No fake data, fake success, or fake metrics.
- Learner UI does not use decorative style trends that compete with learning.
- UI avoids Open Design BJT anti AI-slop failures: fake metrics, filler copy, decorative default gradients, and card-heavy layouts without workflow value.

## Accessibility

- Keyboard usable.
- Focus visible.
- Icon buttons have accessible names.
- Contrast acceptable.
- Reduced motion respected.
- Tables/forms/images/media have required semantics.

## Quality

- Tests added/updated when practical.
- Lint/typecheck run or blocker documented.
- Visual QA checklist or screenshot evidence recorded.
- Five-dimension critique result recorded when admin or learner UI changed.
- Remaining risks have owner and next action.

## Output

```yaml
ui_production_gate:
  status: pass | pass_with_risks | block
  route_or_component: path
  states_checked:
    - loading
    - empty
    - error
  accessibility: pass | risk | block
  i18n: pass | risk | block
  no_fake_success: pass | block
  bjt_ui_ux: pass | risk | block | not_applicable
  evidence:
    - command or review file
```
