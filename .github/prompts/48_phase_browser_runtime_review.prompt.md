# 48 — Phase Browser Runtime Review

<context-hint>
Use at phase close for any phase that changed user-visible admin or learner UI.
</context-hint>

<task>
Act as `bjt-browser-qa`. Produce browser/runtime review evidence for the current phase.
</task>

<required-reading>
1. `.github/agents/bjt.browser-qa.agent.md`
2. `company/BROWSER_PHASE_REVIEW_POLICY.md`
3. `company/gates/browser-phase-review-gate.md`
4. `company/gates/visual-review-gate.md`
5. `company/PHASE_HANDOFF.md`
6. `company/PHASE_TASK_REPORT.md`
7. `company/CURRENT_PHASE.md`
8. changed UI files only
9. `company/ADMIN_MANAGEMENT_WORKFLOW_STANDARD.md` for admin workflow expectations
</required-reading>

<instructions>
1. Identify changed UI routes from phase evidence.
2. If this is admin closeout/full-admin visual audit and `company/admin-module-inventory.md` reports 81 implemented admin routes with only browser evidence pending, review all visible admin nav routes, not only changed routes.
3. If no user-visible UI changed and this is not admin closeout/full-admin visual audit, record `not_applicable`.
4. If UI changed or full-admin visual audit is pending, run the bounded runner first:
   - `PHASE_ID=<phase> BROWSER_REVIEW_APP=web|admin BROWSER_REVIEW_ROUTES=<routes> node scripts/browser-phase-review.mjs`
5. For a full-admin visual audit, set `BROWSER_REVIEW_APP=admin`, `BROWSER_REVIEW_LOCALE=vi` unless another locale is specified, and `BROWSER_REVIEW_ROUTES=__ADMIN_ALL__` so the runner expands every visible admin nav `href`. If local admin credentials are available, pass them only through runtime env vars `BROWSER_REVIEW_ADMIN_USERNAME` and `BROWSER_REVIEW_ADMIN_PASSWORD`; never write the secret values to tracked files or reports. If 81 routes exceed the timeout, split into bounded batches and record each report path.
6. Use `BROWSER_REVIEW_TIMEOUT_MS=120000` and `BROWSER_REVIEW_SERVER_TIMEOUT_MS=60000` unless the phase explicitly sets a smaller limit.
7. Keep `BROWSER_REVIEW_RESTART_ON_404=1` unless the phase explicitly disables restart.
8. If a route returns 404, the bounded runner must restart the selected app server once and retry once.
9. Do not run `pnpm dev`, `next dev`, or Playwright webServer in foreground without timeout/cleanup.
10. Check reachable states and record evidence in `company/reviews/browser-phase-review/`.
11. For admin routes, verify interactions and primary workflows, not only screenshots: filters/search, pagination, tabs, detail links, modals/drawers, refresh/export/preview, and create/edit/archive/publish/retry/cancel/delete/moderation actions when the domain requires them.
12. For write actions, execute only safe local/dev writes or dry-run/confirmation flows; otherwise verify RBAC, confirmation, audit reason/logging path, and record why the action was not executed.
13. If a route only renders data but lacks the expected workflow or management action, return a blocker and route it back to the relevant implementation slice.
14. Mark `AdminResourceTableClient` or equivalent generic read-only table as a blocker for management domains unless the inventory documents an immutable/read-only exception.
15. If the audit uses `ADMIN_TEST_BYPASS` / `NEXT_PUBLIC_ADMIN_TEST_BYPASS`, classify it as visual smoke evidence only. It cannot close final admin functional readiness; continue with authenticated workflow QA or targeted implementation.
16. If browser cannot run, record `blocked_environment` with exact command/error and report path, then continue to Release Director.
17. Do not mark pass without browser/runtime evidence unless the status is `blocked_environment` with a bounded-runner report.
18. Never wait indefinitely; after runner timeout, continue with `blocked_environment` evidence.
19. Do not retry the same browser command more than once unless a concrete UI/browser blocker was fixed.
20. Browser visual audit pending is not a human approval boundary. Return evidence and `next_action: release gate | fix blocker`; do not ask for human review unless the next action is final public launch/go-live.
</instructions>

<output>
```yaml
browser_phase_review:
  status: pass | pass_with_risks | blocked_environment | block | not_applicable
  phase_id: PHASE-XX
  routes_checked:
    - route
  evidence:
    - path
  command: exact command or not_applicable
  timeout_ms: number
  restart_on_404: yes | no
  next_action: release gate | fix blocker
```
</output>
