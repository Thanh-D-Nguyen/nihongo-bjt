# Browser Phase Review Policy

## Purpose

Require a browser/runtime visual check before approving any phase that changes user-visible admin or learner UI.

Browser Phase Review is an executable QA step, not a human approval boundary. When Human Proxy is in unattended admin-production mode and browser visual evidence is the only remaining blocker, it must run `bjt-browser-qa` or `.github/prompts/48_phase_browser_runtime_review.prompt.md`; it must not stop and ask the real human to provide the browser evidence.

## Required When

Run Browser Phase Review when a phase changes:

- admin routes/pages/components
- learner routes/pages/components
- layout, navigation, i18n, visual states, charts, forms, tables
- media/postcards/sharing/battle UI
- quiz, flashcard, reading assist, dashboard, onboarding, or monetization UI

For backend-only phases, record `not_applicable` with reason.

## Preferred Evidence

Use the strongest available option:

1. Bounded runner evidence from `scripts/browser-phase-review.mjs`.
2. Playwright screenshot/test evidence with explicit timeout.
3. Browser-run manual screenshot notes.
4. Component-level visual/state tests plus documented environment blocker.

Do not mark pass when no runtime/browser evidence exists. Use `blocked_environment` or `pass_with_risks`.

## Bounded Execution Rule

Browser Phase Review must never hang indefinitely.

Required:

- Prefer `node scripts/browser-phase-review.mjs`.
- Set `PHASE_ID`.
- Set `BROWSER_REVIEW_ROUTES` to a comma-separated route list.
- Set `BROWSER_REVIEW_APP=web` or `admin`.
- Use bounded defaults:
  - `BROWSER_REVIEW_TIMEOUT_MS=120000`
  - `BROWSER_REVIEW_SERVER_TIMEOUT_MS=60000`
- Do not run `pnpm dev`, `next dev`, or Playwright webServer in foreground without timeout/cleanup.
- If the runner returns `blocked_environment`, record the report path and continue to Release Director as a blocked/risk decision, not an infinite wait.
- If a reviewed route returns 404, restart the selected app server once and rerun the bounded browser review once.
- If the retry passes, treat the browser gate as `pass` and record the restart event.
- If the browser itself cannot open, record `blocked_environment` and continue the production loop; do not stop the whole phase execution solely because a local browser could not launch.

## No Retry Loop Rule

- Run at most two browser review attempts per phase close: initial attempt plus one automatic restart-on-404 retry.
- If the bounded runner returns `blocked_environment`, do not retry the same command repeatedly.
- Record the report path, classify the limitation, and let Release Director decide `pass_with_risks`, `blocked_environment`, or `block`.
- Human Proxy must continue to Release Director after bounded browser evidence is recorded.

Example:

```bash
PHASE_ID=PHASE-04 \
BROWSER_REVIEW_APP=web \
BROWSER_REVIEW_ROUTES=/vi/quiz,/ja/quiz \
BROWSER_REVIEW_TIMEOUT_MS=120000 \
BROWSER_REVIEW_RESTART_ON_404=1 \
node scripts/browser-phase-review.mjs
```

If route discovery is unclear, use the most relevant changed route and record the gap.

## Full Admin Visual Audit

When `company/admin-module-inventory.md` reports 81 implemented admin routes and the only remaining blockers are `needs_browser_visual_review`, run a full admin visual audit instead of stopping for human review.

Required behavior:

- Prefer real local admin login for full admin closeout. Provide credentials only through runtime env vars (`BROWSER_REVIEW_ADMIN_USERNAME`, `BROWSER_REVIEW_ADMIN_PASSWORD`) or a local secret manager; never write credentials into tracked files, reports, prompts, or screenshots.
- If Keycloak blocks headless access and no real test credential is available, use the local/test-only `ADMIN_TEST_BYPASS=1` + `NEXT_PUBLIC_ADMIN_TEST_BYPASS=1` path with a seeded `NEXT_PUBLIC_LOCAL_ADMIN_ACTOR_ID`. This is executable smoke QA setup, not a human approval boundary.
- The bypass must never be used in production, only accepts local API requests, and still relies on backend RBAC through the seeded `authz.admin_actor`.
- Bypass screenshots are route-render smoke evidence only. They cannot be used as final admin functional sign-off because they do not prove real login/session behavior or screen-specific workflows.
- Use `BROWSER_REVIEW_APP=admin`.
- Use `BROWSER_REVIEW_ROUTES=__ADMIN_ALL__` to expand every visible `href` in `apps/admin/lib/admin-nav-data.ts`, prefixed with `BROWSER_REVIEW_LOCALE` such as `/vi`.
- Include desktop and mobile evidence through the bounded runner.
- If the full 81-route run exceeds the bounded timeout, split it into route batches and record every report path.
- After browser evidence exists, continue to Release Director admin sign-off/diff review. Only final public launch/go-live is a real human boundary.

## Required Viewports

- desktop
- mobile
- tablet when layout is complex

## Required States

Check states that are reachable for changed routes:

- loading
- empty
- error
- degraded/partial data
- permission denied
- feature disabled
- happy path

## Required Interaction Coverage

For admin production readiness, browser/runtime review must verify workflows, not only screenshots.

For every visible admin route in the full-admin audit:

- identify the route's intended management workflow from nav label, page UI, inventory, and API contract;
- verify the route satisfies `company/ADMIN_MANAGEMENT_WORKFLOW_STANDARD.md`: read-only display is not enough for a management domain unless a documented immutable/read-only exception exists;
- exercise safe primary interactions such as filters, search, pagination, tabs, detail links, drawers, modals, refresh, export, preview, and navigation state;
- for write workflows, verify the control is present and properly gated; execute only safe/local-dev writes or use dry-run/confirmation flows when available;
- verify destructive actions require explicit confirmation, RBAC/audit reason where required, and do not silently report fake success;
- verify create/edit/archive/publish/retry/cancel/delete/moderate actions exist when the domain requires them, or record the documented domain reason they are intentionally omitted;
- record a blocker when a page merely renders data but lacks the expected end-to-end workflow.
- record a blocker when `AdminResourceTableClient` or an equivalent generic read-only table is the primary UI for a management domain.

For full-admin closeout, a route cannot pass with screenshot evidence alone when its primary workflow is untested or absent.

If the runner reports `local_test_bypass`, the result can close only a visual smoke blocker. Human Proxy must continue with authenticated workflow QA or targeted implementation slices until the route interaction matrix is complete.

## Stop Rule

Release Director must not approve a UI-changing phase unless Browser Phase Review is:

- `pass`
- `pass_with_risks` with accepted non-blocking environment/test limitation
- `blocked_environment` with exact bounded-runner report path and accepted local-browser limitation
- `not_applicable` for backend-only phase

## Output

```yaml
browser_phase_review:
  status: pass | pass_with_risks | blocked_environment | block | not_applicable
  phase_id: PHASE-XX
  routes_checked:
    - route
  viewports:
    - desktop
    - mobile
  evidence:
    - file path
  fallback_reason: none | reason
```
