# Learner Page Production Gate

## Purpose

Learner pages must improve BJT learning outcomes without distraction, shame, fake progress, or privacy leakage.

## Required Checks

- Loads base UI production skills.
- Loads `company/skills/ui-production/12-ux-writing-skill.md`.
- Loads relevant `company/skills/bjt-ui-ux/*.md`.
- Applies `company/gates/ui-production-gate.md`.
- Applies `company/gates/bjt-ui-ux-production-gate.md`.
- Applies `company/gates/open-design-bjt-ui-gate.md`.
- Applies `company/gates/bjt-ui-pro-max-craft-gate.md` for learner-facing screens, visual rescues, and world-class claims.
- Applies `company/gates/world-class-learner-experience-gate.md`.
- Applies learning-quality gate for study/quiz/progress/onboarding flows.
- Reading Assist behavior is preserved where Japanese text needs support.
- Progress, score, and recommendations are backed by real data or clearly marked incomplete.
- Estimated BJT score/band is labeled estimated.
- Mistake feedback maps to remediation where applicable.
- Sensory/media/social features are opt-in or user-controlled when distracting.
- Public sharing does not leak private learning data.
- Open Design BJT five-dimension critique has no score below `3/5`.
- World-class learner experience scores are all `4/5` or higher before claiming world-class quality.
- CTA contrast and footer/trust surface checks pass for app-shell learner screens.
- CTA state matrix and behavioral psychology review pass when primary/auth/social/study actions are in scope.
- Repeated button rejection uses prompt 56 and variant review; no color-only/shadow-only rescue can pass.

## Blockers

- Fake learner progress.
- Shame-based copy.
- Timed exam mode reveals forbidden help.
- Estimated score presented as official.
- Public share leaks private user data.
- Media/motion distracts from core study task.
- Generic visual trend is applied without learning benefit.
- Generic beige/card-grid learner UI is marked verified without visual rescue.
- Primary CTA is visually weak, hard to read, or easy to miss.
- Auth/login CTA is visually weak or blends into its panel.
- Footer/trust surface is missing.
- BJT UI Pro Max craft gate is missing or blocked.
- Repeated Pro Max pass is contradicted by human screenshot review.
- Behavioral psychology review is missing for CTA, habit, login, progress, battle, share, comeback, or result flows.
- Open Design BJT P0 gate fails.

## Output

```yaml
learner_page_gate:
  status: pass | pass_with_risks | block
  page: route
  learning_effect: pass | risk | block
  reading_assist: pass | not_applicable | block
  privacy: pass | risk | block
  visual_qa: pass | risk | block
```
