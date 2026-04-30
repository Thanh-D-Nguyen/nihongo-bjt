# BJT UI/UX Production Standard

## Purpose

Define the product design standard for NihonGo BJT.

The goal is not generic beauty. The goal is a serious, focused, high-trust BJT learning product that helps learners understand Japanese, practice consistently, recover from mistakes, and see real progress.

## Adapted Inspiration

External UI/UX skill systems are useful for:

- generating design direction before coding
- matching style to product domain
- defining anti-patterns
- requiring pre-delivery accessibility/responsive checks
- using dashboard/chart guidance intentionally

For NihonGo BJT, these ideas must be filtered through learning science, exam integrity, Japanese readability, privacy, and no-fake-production rules.

Reference reviewed: `https://github.com/nextlevelbuilder/ui-ux-pro-max-skill`. This project adopts the operating pattern of design direction, anti-patterns, and pre-delivery checks; it does not copy a generic style pack into the product.

## Product Design Direction

- Audience: Vietnamese adults learning Japanese for BJT/work/life in Japan.
- Tone: calm, competent, warm, precise.
- Layout: task-first, study-first, low-distraction.
- Typography: readable Vietnamese/Japanese text, generous line height for Japanese passages.
- Color: restrained neutral system with strong semantic states.
- Motion: feedback and orientation only.
- Signature differentiator: reading assist plus remediation turns difficult Japanese into the next study action.

## Surface Standards

| Surface | Design intent | Must avoid |
|---|---|---|
| Learner dashboard | clear daily next action | generic card wall |
| Flashcards | fast review and context memory | isolated vocab grind |
| Quiz/practice | retrieval plus feedback | score-only results |
| Mock exam | quiet exam console | help leakage or playful distraction |
| Reading assist | reduce Japanese friction | tooltip clutter |
| Progress | mastery and effort truth | fake XP/rank inflation |
| Battle/social | opt-in motivation | shame, pay-to-win, privacy leaks |
| Admin | operational clarity | marketing layout or vague scaffolds |

## Approved Style Palette

Prefer:

- accessible ethical education
- Swiss/minimal operational clarity
- e-ink/paper reading feel for long Japanese text
- data-dense admin analytics
- restrained editorial postcard visuals
- subtle microinteractions

Avoid by default:

- cyberpunk, neon, crypto aesthetics
- AI-purple gradient dominance
- heavy glassmorphism
- childish claymorphism
- landing-page hero composition inside app workflows
- decorative 3D or parallax in core study

## Required UI/UX Gate

Any major learner UI or learning-operation admin UI must pass:

- `company/gates/ui-production-gate.md`
- `company/gates/bjt-ui-ux-production-gate.md`
- `company/gates/learner-page-production-gate.md` or `company/gates/admin-page-production-gate.md`
- relevant domain gate: learning, assessment, media, growth, privacy/security

## Review Evidence

Use:

- screenshots or browser review when possible
- manual visual review when browser is blocked
- component tests for data states
- i18n key review for Vietnamese/Japanese copy
- accessibility checks for keyboard, focus, contrast, reduced motion

## Page Overrides

Use `docs/design/page-overrides/_template.md` when a route needs extra direction beyond this master standard.

Page override rules:

- override only what is different for the route
- do not weaken the master standard
- include BJT-specific risks and gate evidence
- keep the file short enough for agents to read every time they touch that route
