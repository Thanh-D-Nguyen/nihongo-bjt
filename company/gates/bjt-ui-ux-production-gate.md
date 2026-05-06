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
- `company/skills/bjt-ui-ux/09-bjt-ui-pro-max-craft-skill.md` and `company/gates/bjt-ui-pro-max-craft-gate.md` for learner-facing screens, visual rescues, and world-class claims
- `company/gates/assessment-quality-gate.md` for quiz/mock exam
- `company/gates/media-quality-gate.md` for media/postcard
- `company/gates/growth-ethics-gate.md` for social/competition
- `company/gates/world-class-learner-experience-gate.md` for every learner-facing screen

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
- desktop and mobile screenshots pass the world-class learner experience gate for learner screens
- BJT UI Pro Max craft gate passes for learner-facing screens, visual rescues, and world-class claims
- repeated Pro Max rejection has direct source access evidence or remains blocked
- repeated button rejection includes a materially different CTA system selected from at least 3 variants
- primary/auth CTA contrast evidence is recorded and passes WCAG AA for readable text
- primary/auth CTA state matrix covers default, hover, focus-visible, active, loading, and disabled states
- behavioral psychology review passes for CTA, login, habit, progress, battle, share, comeback, and result flows
- learner shell footer/trust surface exists where the learner app frame is visible

## Blockers

- UI is visually polished but learning intent is unclear
- learner cannot tell what to do next
- Japanese text is hard to read or unsupported
- score/band claim is misleading
- exam mode leaks help/answers
- media/motion distracts from study
- social/gamification causes shame, spam, or privacy exposure
- admin learning operations page is too vague to support real work
- learner UI looks generic, bland, card-grid-heavy, or below world-class screenshot quality
- primary buttons are hard to see, low contrast, cramped, or ambiguous
- human screenshot feedback says the UI looks cheap/generic/bland and no rescue pass has been completed
- self-scored visual pass contradicts the latest human screenshot review
- footer/trust surface is missing from learner app shell screens
- no BJT UI Pro Max design-system brief exists before a visual rescue implementation
- repeated CTA rescue only changes color, radius, shadow, or font weight
- latest human feedback rejects CTA visibility while status is reported as `pending_human_review` or `completed`
- `bjt-behavioral-psychology` is skipped without reason for CTA, login, habit, progress, battle, share, comeback, or result flows

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
