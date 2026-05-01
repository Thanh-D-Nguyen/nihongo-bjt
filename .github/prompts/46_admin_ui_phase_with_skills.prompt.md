# 46 — Admin UI Phase with Production Skills

<context-hint>
Use when running PHASE_BATCH mode for Admin Production Completion or any large admin UI completion phase.
</context-hint>

<task>
Act as `bjt-boss`. Run admin UI work with production UI/UX skills and gates.
</task>

<required-reading>
1. `company/OPERATING_MODE.md`
2. `company/TOKEN_BUDGET_PROTOCOL.md`
3. `docs/spec/digests/admin_ui_digest.md`
4. `docs/spec/compact/05_admin_ui_modules.md`
5. `docs/spec/compact/04_admin_rbac.md`
6. `company/skills/agent-quality/00-karpathy-production-agent-skill.md`
7. `company/skills/ui-production/00-ui-production-principles.md`
8. `company/skills/ui-production/01-design-system-skill.md`
9. `company/skills/ui-production/02-page-composition-skill.md`
10. `company/skills/ui-production/05-data-state-skill.md`
11. `company/skills/ui-production/06-accessibility-skill.md`
12. `company/skills/ui-production/07-responsive-layout-skill.md`
13. `company/skills/ui-production/10-i18n-localization-skill.md`
14. `company/skills/ui-production/14-production-ui-done-definition.md`
15. `company/skills/open-design-bjt/00-open-design-bjt-adaptation.md`
16. `company/gates/ui-production-gate.md`
17. `company/gates/admin-page-production-gate.md`
18. `company/gates/open-design-bjt-ui-gate.md`
19. `company/ADMIN_COMPLETION_PROGRAM.md`
20. `company/admin-module-inventory.md`
21. `company/gates/admin-100-completion-gate.md`
22. `company/ADMIN_MANAGEMENT_WORKFLOW_STANDARD.md`
23. `docs/design/bjt-ui-ux-production-standard.md` when the admin page controls learner content, assessment, reading assist, media, growth, or learning operations
24. `company/gates/bjt-ui-ux-production-gate.md` when applicable
</required-reading>

<conditional-reading>
- table page: `company/skills/ui-production/03-admin-table-skill.md`
- form page: `company/skills/ui-production/04-form-validation-skill.md`
- dashboard/analytics page: `company/skills/ui-production/08-dashboard-data-viz-skill.md`
- media/postcard page: media experience digest and `company/skills/ui-production/09-motion-microinteraction-skill.md`
- performance-sensitive page: `company/skills/ui-production/11-performance-skill.md`
- visual handoff: `company/skills/ui-production/13-visual-qa-checklist.md`
</conditional-reading>

<instructions>
Before each admin UI task:
1. Load relevant UI production skills.
2. Use the fewest agents needed.
3. Keep page scope small and reviewable.
4. State assumptions, design direction, acceptance criteria, and verification path before editing.
   - Include the route's admin decision and required management actions.
   - A page that only renders information/table data does not pass unless the domain is intentionally immutable/read-only and the inventory records the reason.
5. Require permission-aware actions, feature-flag states, i18n labels, loading/empty/error/degraded states, responsive layout, accessibility, no fake success, and no raw technical labels.
6. Apply `company/gates/admin-page-production-gate.md` and `company/gates/open-design-bjt-ui-gate.md`.
7. Record the Open Design BJT five-dimension critique in the handoff.
8. Record screenshot evidence or manual visual QA using `company/reviews/ui-visual-review/_template.md`.
9. Do not mark page production-ready until the gates pass.
10. When the task is part of admin workspace completion, update `company/admin-module-inventory.md` and reduce the enabled scaffold count.
</instructions>

<stop-conditions>
- admin write lacks backend RBAC or audit path
- page needs fake data to look complete
- management route would remain a read-only generic table without a documented immutable/read-only exception
- UI cannot represent required data states
- visual QA cannot be completed and no manual blocker is recorded
- Open Design BJT P0 gate fails or any five-dimension critique score is below `3/5`
- enabled admin scaffold count does not decrease for a completion task and no backend blocker is recorded
- task would touch protected modules without approval
</stop-conditions>
