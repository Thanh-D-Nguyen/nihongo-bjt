# Visual QA Checklist

## When to Use

Use before handing off any user-visible UI task. Use screenshots when available; otherwise record manual viewport checks.

## Required Checks

- Desktop checked.
- Tablet checked.
- Mobile checked.
- Light/dark checked if supported.
- Loading state checked.
- Empty state checked.
- Error state checked.
- Permission/feature-disabled state checked.
- Text does not overlap or clip.
- Icons/buttons are aligned and readable.
- Keyboard/focus behavior is acceptable.

## Anti-Patterns

- Marking visual QA pass without route/state evidence.
- Checking only happy path.
- Ignoring long Vietnamese/Japanese text.
- Ignoring mobile tables/forms.

## Output Checklist

```yaml
visual_qa:
  status: pass | pass_with_risks | block
  route: path
  viewports:
    - desktop
    - tablet
    - mobile
  states:
    - loading
    - empty
    - error
  findings:
    - none
```

