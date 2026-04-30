# 50 — Admin 100% Completion Phase

<task>
Act as `bjt-boss`. Execute admin workspace completion group-by-group until enabled admin scaffold count reaches zero or a hard stop occurs.
</task>

<required-reading>
1. `company/ADMIN_COMPLETION_PROGRAM.md`
2. `company/admin-module-inventory.md`
3. `company/gates/admin-100-completion-gate.md`
4. `company/ADMIN_PRODUCTION_ORCHESTRATION.md`
5. `company/gates/admin-page-production-gate.md`
6. `company/gates/ui-production-gate.md`
7. `company/gates/open-design-bjt-ui-gate.md`
8. `company/skills/agent-quality/00-karpathy-production-agent-skill.md`
9. `company/skills/ui-production/`
10. `company/skills/open-design-bjt/00-open-design-bjt-adaptation.md`
11. `docs/admin-navigation.md`
12. `docs/spec/digests/admin_ui_digest.md`
13. `docs/spec/compact/04_admin_rbac.md`
14. `docs/spec/compact/05_admin_ui_modules.md`
15. relevant compact spec for the selected module group
</required-reading>

<instructions>
1. If `company/admin-module-inventory.md` is stale or incomplete, run `.github/prompts/49_admin_100_completion_audit.prompt.md` first.
2. If the human requested admin production readiness, use `company/ADMIN_PRODUCTION_ORCHESTRATION.md` priority queue. Otherwise pick exactly one admin group from the inventory using the standard completion order:
   - Admin Shell/sidebar navigation UX
   - System, Operations, IAM
   - Content, Import, i18n, Media
   - Assessment, Learning, Reading Assist
   - Users, Support, Privacy, Legal
   - Monetization, Ads, Billing
   - Analytics, Growth, Battle
   - Full-route source/visual audit for old or untouched admin screens
3. For each selected group, complete backend/API contracts before replacing scaffold UI.
4. Replace scaffold pages with production pages connected to real APIs/provider abstractions.
5. Remove `status: "scaffold"` only after the module passes gates.
6. Apply UI production skills, `admin-page-production-gate.md`, and `open-design-bjt-ui-gate.md`.
7. Record the Open Design BJT five-dimension critique and fix any score below `3/5`.
8. Fix product-depth blockers, not just scaffold markers: duplicate generic pages, planned-notice/info-only pages, static back-link stubs, missing route-specific workflow, and read-only pages where management actions are required.
9. If the selected group is Admin Shell/sidebar navigation UX, fix the global left-nav information architecture: collapsible or otherwise compact groups, exact active state, no double highlight, clear scroll affordance, keyboard/focus accessibility, and responsive behavior.
10. If the selected group is full-route source/visual audit, inspect every visible admin route for route-specific workflow, old UI reuse, missing state coverage, visual quality, and browser evidence. Route any failed screen to the next implementation slice instead of closeout.
11. Run targeted tests/typecheck and visual/browser review for changed admin routes.
12. Update inventory, phase reports, risk log, project state, and handoff.
13. Continue in unattended mode without stopping for owner-agent handoff when policy permits.
14. Do not classify a hidden/default-off route as production-ready. Hidden/default-off is not a completion path for the current full 100% admin functionality directive; admin production-ready requires implementing the real slice. Only a later explicit human instruction can change that target.
15. If the selected group passes and unattended delegation is active, record the pass, select the next incomplete group from `company/ADMIN_PRODUCTION_ORCHESTRATION.md`, and continue. Do not stop at `next_agent` / `next_action`, do not select closeout, and do not wait for human approval unless all product-depth groups are cleared or a hard stop exists.
16. If all source/product-depth groups are cleared and only `needs_browser_visual_review` / `browser_visual_review_pending` remains, select `.github/prompts/48_phase_browser_runtime_review.prompt.md` for full-admin browser QA across all 81 routes. This is not a human review boundary.
</instructions>

<hard-stops>
- destructive migration or data deletion risk
- backend RBAC/audit ambiguity for admin write
- fake data or fake success would be required
- external provider secret is required for production behavior
- tests/typecheck/build cannot be restored after 2 targeted fixes
- Release Director returns `no_ship`
</hard-stops>

<definition-of-done>
- selected admin group has zero scaffold routes
- selected admin group has zero product-depth blockers: duplicate route, planned notice, missing workflow, temporary UI, read-only-when-management-required, or connected-but-incomplete route
- if Admin Shell/sidebar was in scope, left navigation is production-grade with long-menu UX handled
- if full-route audit was in scope, every visible admin route has current browser/source evidence or a blocker/next implementation slice
- selected group rows in `company/admin-module-inventory.md` are updated
- Admin page gates pass for changed pages
- Open Design BJT UI gate passes for changed UI
- Admin 100 gate count moves closer to zero
- next incomplete admin group is selected when unattended delegation is active
- final project production readiness is not claimed until Admin 100 gate passes globally and the human's admin production-ready target is fully satisfied
</definition-of-done>
