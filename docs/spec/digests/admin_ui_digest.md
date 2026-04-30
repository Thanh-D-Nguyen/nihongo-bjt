# Admin UI Digest

Default tier: balanced. Escalate to code-heavy for API/client wiring, permissions, complex state, or tests.

## Must read

- `docs/spec/index.md`
- `docs/spec/compact/05_admin_ui_modules.md`
- `docs/spec/compact/04_admin_rbac.md`

## Conditional reads

- Backend/API contracts: `compact/03_backend_api_registry.md`
- Privacy/security admin: `compact/07_security_privacy.md`
- Monetization admin: `compact/08_monetization.md`
- Analytics/release checks: `compact/10_testing_acceptance.md`

## Done

- Uses i18n keys for user-facing text.
- Navigation/actions are RBAC-aware.
- Data comes from real API contracts or clearly marked feature-flagged route shell.
- Loading, error, empty, degraded, and permission-denied states exist.
- Admin mutations call audited backend endpoints.

## Avoid

- Fake charts or fake production data.
- UI-only permission enforcement.
- Marketing-style hero pages in admin.
- Screens that look complete but cannot perform workflow.

## Check commands

- Run available frontend lint/typecheck/test/build scripts.
- Search for hard-coded labels in changed UI files.
- Verify permission-denied and empty states manually or with tests where possible.

## Escalate

Escalate when adding a new admin module, changing RBAC, creating admin writes, touching analytics exports, or connecting billing/privacy flows.

## UI production skills

Must read for admin UI tasks:

- `company/skills/ui-production/00-ui-production-principles.md`
- `company/skills/ui-production/01-design-system-skill.md`
- `company/skills/ui-production/02-page-composition-skill.md`
- `company/skills/ui-production/05-data-state-skill.md`
- `company/skills/ui-production/06-accessibility-skill.md`
- `company/skills/ui-production/10-i18n-localization-skill.md`
- `company/skills/ui-production/14-production-ui-done-definition.md`
- `company/gates/ui-production-gate.md`
- `company/gates/admin-page-production-gate.md`

Conditional:

- tables: `company/skills/ui-production/03-admin-table-skill.md`
- forms: `company/skills/ui-production/04-form-validation-skill.md`
- dashboards: `company/skills/ui-production/08-dashboard-data-viz-skill.md`
- visual handoff: `company/skills/ui-production/13-visual-qa-checklist.md`
