# Admin 100 Authenticated Browser Audit — 2026-04-30

Phase ref: ADMIN-100-AUTH-WORKFLOW
Reviewer agent: bjt-browser-qa (executed via `scripts/browser-phase-review.mjs`)
Policy: `company/BROWSER_PHASE_REVIEW_POLICY.md` (Full Admin Auth Workflow Audit)
Spec: `.github/prompts/48_phase_browser_runtime_review.prompt.md`

## Trigger

Per human directive: bypass-only screenshot PASS is **visual smoke only, not admin
production readiness**. Re-run authenticated audit with real `localadmin` Keycloak
credential to exercise login + render + workflow surfaces.

## Executable command

```bash
PHASE_ID=ADMIN-100-AUTH-WORKFLOW \
BROWSER_REVIEW_APP=admin \
BROWSER_REVIEW_LOCALE=vi \
BROWSER_REVIEW_ROUTES=__ADMIN_ALL__ \
BROWSER_REVIEW_ADMIN_USERNAME=localadmin \
BROWSER_REVIEW_ADMIN_PASSWORD='Admin123456!' \
BROWSER_REVIEW_TIMEOUT_MS=900000 \
node scripts/browser-phase-review.mjs
```

Server: `http://127.0.0.1:3001` (admin dev, **no bypass**, real Keycloak required).

## Pre-audit fixes that unblocked authenticated rendering

The first authenticated run failed (login form posted GET with credentials in URL
because hydration hadn't completed when Playwright clicked submit). Fixes applied:

1. `apps/admin/app/api/auth/keycloak/password-login/route.ts` — added
   form-encoded POST handler with 303 redirect + cookie set, so login works even
   when JS hasn't hydrated.
2. `apps/admin/app/[locale]/login/_components/admin-login-form-client.tsx` — added
   `action="/api/auth/keycloak/password-login"`, `method="post"`, and hidden
   `returnTo` + `locale` inputs.
3. `apps/admin/app/[locale]/login/page.tsx` — pass `locale` prop to form.
4. `apps/admin/app/[locale]/layout.tsx` — server-side check for `kc_access_token`
   / `kc_refresh_token` cookies; pass `initialAuthed` prop to the session gate so
   authenticated admins render the shell immediately instead of flashing the busy
   screen.
5. `apps/admin/app/_components/admin-keycloak-session-gate.tsx` — accept
   `initialAuthed`, validate in the background, only flip back to busy if no
   cookies are present.
6. `packages/shared/src/admin-permissions.js` — added missing exports
   (`ADMIN_SYSTEM_ROLE`, `ADMIN_SYSTEM_ROLE_PERMISSION_MATRIX`,
   `ADMIN_ROUTE_GROUP_PERMISSIONS`, `toRolePermissionSet`) so users console
   client compiles without dev warnings.
7. `packages/ui/src/admin-shell.tsx` — fixed SSR/CSR hydration mismatch in the
   sidebar (deferred `localStorage` read to `useEffect`); added Vietnamese labels
   to the previously-orphan `▼ ▶` expand/collapse controls.

These were real, ship-blocking defects that the bypass screenshot pass had hidden.

## Runner result

- Status: **BLOCKED_ENVIRONMENT** (timeout after 15 min, 139/162 screenshots
  captured before timeout). Login itself succeeded (`attempt 1: desktop
  authenticated through admin password login`, same for mobile).
- Report: `company/reviews/browser-phase-review/admin-100-auth-workflow-2026-04-30T12-36-24-034Z.md`.
- Artifacts: `company/reviews/browser-phase-review/artifacts/ADMIN-100-AUTH-WORKFLOW-2026-04-30T12-36-24-034Z/`.

The timeout itself is not the blocker — dev mode is slow on first paint of each
route, and 162 routes × {desktop, mobile} × hydration is over the 15 min budget.
The real blockers are visible in the captured screenshots.

## Visible blockers in authenticated screenshots

| Severity | Blocker | Sample evidence | Affected scope |
|---|---|---|---|
| **CRITICAL** | `AdminResourceTableClient` is a shallow generic shell | `desktop-vi-assessment-quiz-templates.png`, `desktop-vi-users.png`, `desktop-vi-iam.png`, dozens more | ~40 routes (assessment/*, battle/*, content/*, learning/*, growth/*, iam/*, monetization/*, ops/*, import/*, privacy/*, support/*, legal/*, flashcards/*, etc.) |
| HIGH | IAM dashboard renders `Đang tải quyền...` indefinitely; KPI cards do not appear | `desktop-vi-iam.png` | /iam |
| HIGH | /users dashboard subtitle promises KPI/filters/audit but body shows only `Đang tải...` | `desktop-vi-users.png` | /users |
| MEDIUM | Sidebar `▼ ▶` orphan expand/collapse buttons (no labels) | every screenshot | every page |

The MEDIUM blocker is **resolved in this cycle** — `packages/ui/src/admin-shell.tsx`
now renders `▼ Mở rộng` / `▶ Thu gọn` with Vietnamese labels.

## What `AdminResourceTableClient` is missing

Looking at `desktop-vi-assessment-quiz-templates.png` (representative sample of
~40 routes that all use this component):

- ❌ No Create button (cannot add a quiz template)
- ❌ No Edit / drawer / detail link
- ❌ No Archive / Publish / Restore actions
- ❌ No Filter (by type, status, level, owner, date)
- ❌ No Search input
- ❌ No Pagination controls
- ❌ No Sort headers
- ❌ No bulk action / multi-select
- ❌ No action confirmation modal with audit reason
- ❌ No empty-state CTA
- ❌ No record-count + total + page-size

What it **does** render:
- ✅ Page title and subtitle
- ✅ "Bản ghi: 0" line
- ✅ "Đang tải..." then a basic read-only table

This is the "shallow generic admin" the human explicitly rejected. The bypass
screenshot pass missed it because the auth-gate flash + 1s settle window
captured before `Đang tải...` resolved, and the missing CRUD controls were not
in the visual diff.

## Source-side completion signals (still green)

- 81/81 nav items implemented; 0 scaffold renderers; 0 disabled feature flags.
- 0 placeholder strings (`planned notice|will be implemented|Phase 11|coming soon|under construction|renderAdminScaffold`).
- All 81 routes return HTTP 200.
- Admin login flow works end-to-end (form-encoded fallback + JS path).
- SSR optimistic gate eliminates auth-gate flash for authenticated admins.

## Recommendation

**`reopen_admin_completion — replace_admin_resource_table_client_with_real_workflow_components`**

The path to admin 100% production readiness now requires:

1. Per-domain real workflow components to replace `AdminResourceTableClient`. Each
   domain (Quiz Templates, Mock Exams, Battle Configs, Battle Bots, Growth
   Campaigns, IAM Roles, etc.) needs:
   - Server-side filter/search/sort/paginate via existing endpoints (or extend
     them where they don't accept these query params yet).
   - Create, Edit, Archive/Publish actions with confirmation modals and audit
     trail.
   - Detail page or drawer per record with relationships, history, related
     workflows.
2. Diagnose IAM dashboard infinite loading; verify /api/admin/iam endpoints
   return for localadmin.
3. Diagnose Users page shallow render; ensure /api/admin/users returns and KPI
   panels render.
4. Re-run authenticated browser audit after each implementation slice.
5. Consider bumping `BROWSER_REVIEW_TIMEOUT_MS` to ≥ 1800000 (30 min) for full
   162-screenshot coverage in dev mode, or run audit against `pnpm build && pnpm
   start` for faster paint.

This is multi-cycle work. Slice owners: `bjt-admin-ui` (UI components, workflow
states, accessibility, design tokens), `bjt-backend` (extend admin endpoints with
filter/search/sort/paginate query params and create/update/archive/publish
mutations + audit log entries), `bjt-security` (review every new write surface
for RBAC + audit + IDOR + rate limit), `bjt-qa` (re-run authenticated audit per
slice).

## Artifacts

- Report: `company/reviews/browser-phase-review/admin-100-auth-workflow-2026-04-30T12-36-24-034Z.md`
- Screenshots (139 captured, 23 missing due to timeout):
  `company/reviews/browser-phase-review/artifacts/ADMIN-100-AUTH-WORKFLOW-2026-04-30T12-36-24-034Z/`
- Sampled blockers: `desktop-vi-iam.png`, `desktop-vi-users.png`,
  `desktop-vi-assessment-quiz-templates.png`
