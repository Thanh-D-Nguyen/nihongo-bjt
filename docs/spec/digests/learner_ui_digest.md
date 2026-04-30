# Learner UI Digest

Default tier: balanced. Escalate to code-heavy for API/client integration, persisted state, exam logic, or tests.

## Must read

- `docs/spec/index.md`
- `docs/spec/compact/06_learner_ui_modules.md`
- `docs/spec/compact/10_testing_acceptance.md`

## Conditional reads

- Backend/API contracts: `compact/03_backend_api_registry.md`
- Reading Assist internals: `compact/02_database_prisma.md`, `compact/03_backend_api_registry.md`
- Privacy/share flows: `compact/07_security_privacy.md`
- Premium/quota UX: `compact/08_monetization.md`
- Focus/media/competition: `compact/11_learning_effectiveness_experience.md`

## Done

- UI is mobile-first, responsive, and production quality.
- User-facing text uses i18n keys.
- Persistent learning data uses real APIs/storage contracts.
- Loading, error, empty, offline/degraded states exist.
- Reading Assist can be reused by Japanese text components.
- Timed BJT exam mode does not reveal meanings during active exam unless allowed.
- Sensory/social features support focus and real learning progress.

## Avoid

- Fake progress/analytics.
- Local-only persistent domain state.
- Shame-based copy.
- Private learning data in share URLs or OG metadata.
- Page-specific demo reading tooltips.
- Autoplay media, distracting motion, fake ranks, or manipulative streak pressure.

## Check commands

- Run available frontend lint/typecheck/test/build scripts.
- Smoke critical routes changed.
- Check responsive layout and text fit for mobile/desktop.

## Escalate

Escalate for exam scoring/timing, privacy-sharing boundaries, monetization gates, reusable Reading Assist architecture, competition/motivation loops, media provenance, or cross-module data contracts.

## UI production skills

Must read for learner UI tasks:

- `company/skills/ui-production/00-ui-production-principles.md`
- `company/skills/ui-production/01-design-system-skill.md`
- `company/skills/ui-production/02-page-composition-skill.md`
- `company/skills/ui-production/05-data-state-skill.md`
- `company/skills/ui-production/06-accessibility-skill.md`
- `company/skills/ui-production/10-i18n-localization-skill.md`
- `company/skills/ui-production/12-ux-writing-skill.md`
- `company/skills/ui-production/14-production-ui-done-definition.md`
- `company/gates/ui-production-gate.md`
- `company/gates/learner-page-production-gate.md`

Conditional:

- study/quiz/progress: `company/gates/learning-quality-gate.md`
- dashboards/progress charts: `company/skills/ui-production/08-dashboard-data-viz-skill.md`
- media/postcards: media experience digest and motion skill
- visual handoff: `company/skills/ui-production/13-visual-qa-checklist.md`
