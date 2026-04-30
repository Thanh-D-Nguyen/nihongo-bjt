# BJT UI/UX Production Gate

## Purpose

Ensure UI quality is not only visually polished, but improves BJT learning outcomes.

Use this gate for learner UI, assessment UI, reading-assist UI, public share pages, and admin pages that directly affect learning operations.

## Required Reads

- `company/skills/bjt-ui-ux/00-bjt-ui-ux-principles.md`
- `company/skills/bjt-ui-ux/01-bjt-design-direction-system.md`
- relevant `company/skills/bjt-ui-ux/*.md`
- `company/gates/ui-production-gate.md`
- `company/gates/learner-page-production-gate.md` for learner pages
- `company/gates/admin-page-production-gate.md` for admin learning operations pages
- `company/gates/learning-quality-gate.md` for study/progress/remediation
- `company/gates/assessment-quality-gate.md` for quiz/mock exam
- `company/gates/media-quality-gate.md` for media/postcard
- `company/gates/growth-ethics-gate.md` for social/competition

## Pass Checklist

- design direction is specific to the route/flow
- learner/admin primary action is clear
- cognitive load is controlled
- Japanese text is readable and supported
- learning progress and analytics are backed by real data
- quiz/exam mode preserves integrity
- remediation exists for mistakes where applicable
- media/motion/social features are user-controlled
- localization is natural for Vietnamese/Japanese users
- accessibility and mobile behavior are reviewed
- no fake production workflow, fake progress, or fake score claim

## Blockers

- UI is visually polished but learning intent is unclear
- learner cannot tell what to do next
- Japanese text is hard to read or unsupported
- score/band claim is misleading
- exam mode leaks help/answers
- media/motion distracts from study
- social/gamification causes shame, spam, or privacy exposure
- admin learning operations page is too vague to support real work

## Output

```yaml
bjt_ui_ux_gate:
  status: pass | pass_with_risks | block
  route_or_flow: path
  design_direction: pass | risk | block
  learning_focus: pass | risk | block
  japanese_readability: pass | risk | block
  assessment_integrity: pass | not_applicable | risk | block
  media_social_safety: pass | not_applicable | risk | block
  accessibility_mobile: pass | risk | block
  evidence:
    - command, screenshot, or review file
  blockers:
    - none
```

