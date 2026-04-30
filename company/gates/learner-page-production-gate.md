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
- Applies learning-quality gate for study/quiz/progress/onboarding flows.
- Reading Assist behavior is preserved where Japanese text needs support.
- Progress, score, and recommendations are backed by real data or clearly marked incomplete.
- Estimated BJT score/band is labeled estimated.
- Mistake feedback maps to remediation where applicable.
- Sensory/media/social features are opt-in or user-controlled when distracting.
- Public sharing does not leak private learning data.
- Open Design BJT five-dimension critique has no score below `3/5`.

## Blockers

- Fake learner progress.
- Shame-based copy.
- Timed exam mode reveals forbidden help.
- Estimated score presented as official.
- Public share leaks private user data.
- Media/motion distracts from core study task.
- Generic visual trend is applied without learning benefit.
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
