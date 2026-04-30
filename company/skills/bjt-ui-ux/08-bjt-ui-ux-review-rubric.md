# BJT UI/UX Review Rubric

## When to Use

Use before marking any learner-facing UI, study/admin learning workflow, or major redesign as production-ready.

## Score Each Area

Use `pass`, `risk`, or `block`.

- learning intent: screen supports a real learning outcome
- next action: user knows what to do now
- cognitive load: choices and visual weight are controlled
- Japanese readability: text support and spacing are adequate
- remediation: mistakes lead to a specific next step
- data truth: progress/score/analytics are real or clearly unavailable
- accessibility: keyboard, focus, contrast, reduced motion, labels
- mobile: 375px, touch, and interruption behavior
- media/motion: user-controlled and learning-purposeful
- privacy/social: sharing and competition are safe and opt-in
- localization: Vietnamese/Japanese copy is natural

## Blockers

- fake learning progress
- score/band presented as official when estimated
- exam mode leaks forbidden help or answer keys
- distracting autoplay or motion in study
- shame, pressure, or dark pattern
- public share leaks private learning data
- UI looks production-complete but core workflow is missing

## Output

```yaml
bjt_ui_ux_review:
  status: pass | pass_with_risks | block
  route_or_flow: path
  learning_intent: pass | risk | block
  focus: pass | risk | block
  japanese_readability: pass | risk | block
  remediation: pass | risk | block
  accessibility_mobile: pass | risk | block
  media_social_privacy: pass | risk | block
  blockers:
    - none
  evidence:
    - file, screenshot, or command
```

