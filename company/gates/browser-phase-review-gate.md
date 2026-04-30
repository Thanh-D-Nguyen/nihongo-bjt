# Browser Phase Review Gate

## Purpose

Ensure user-visible phase work is checked in a browser/runtime, not only by source review.

## Gate Checklist

- Changed UI routes are listed.
- Bounded browser/Playwright attempt is recorded.
- `scripts/browser-phase-review.mjs` was used, or equivalent timeout/cleanup was documented.
- 404 responses trigger one automatic server restart and retry.
- Desktop and mobile evidence exists, or environment blocker is explicit.
- Loading, empty, error, degraded, permission, feature-disabled, and happy states are checked where reachable.
- No text overlap/clipping is observed.
- i18n text renders without raw keys.
- Reading Assist/quiz/study restrictions are respected where relevant.
- No fake success or fake production data is used to satisfy the review.

## Blockers

- UI-changing phase has no browser/runtime evidence and no environment blocker.
- Browser reveals broken route, hydration failure, unreadable layout, or raw i18n keys.
- Timed quiz/exam UI leaks answer/help state.
- Permission or feature-disabled state cannot be represented for gated admin/learner UI.
- Browser review command hangs or lacks timeout/cleanup.
- Same browser command is retried repeatedly after `blocked_environment` without a concrete fix.
- 404 is treated as final without one bounded restart retry.

## Output

```yaml
browser_phase_review_gate:
  status: pass | pass_with_risks | blocked_environment | block | not_applicable
  evidence_files:
    - path
  routes_checked:
    - route
  blockers:
    - none
  timeout_bounded: yes | no
```
