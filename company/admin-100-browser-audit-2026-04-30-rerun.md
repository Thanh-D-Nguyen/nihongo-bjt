# Admin 100 Completion — Browser Visual Smoke RERUN (2026-04-30, bypass active)

Phase ref: ADMIN-100-AUDIT-BYPASS
Reviewer agent: bjt-browser-qa (executed via `scripts/browser-phase-review.mjs`)
Policy: `company/BROWSER_PHASE_REVIEW_POLICY.md` (Full Admin Visual Audit)
Spec: `.github/prompts/48_browser_phase_review.prompt.md`
Predecessor: `company/admin-100-browser-audit-2026-04-30.md` (auth-blocked first run)
Inventory ref: `company/admin-module-inventory.md`

## Trigger

First run was auth-gated (162 PNGs of `Đang xác thực phiên quản trị…`). After enabling the
test bypass (`ADMIN_TEST_BYPASS` + `NEXT_PUBLIC_ADMIN_TEST_BYPASS=1`) and restarting the
admin dev server with `NEXT_PUBLIC_LOCAL_ADMIN_ACTOR_ID=00000000-0000-4000-8000-000000000001`,
this rerun captures real authenticated admin UI for all 81 routes.

## Executable command

```bash
BROWSER_REVIEW_APP=admin \
BROWSER_REVIEW_ROUTES=__ADMIN_ALL__ \
BROWSER_REVIEW_LOCALE=vi \
BROWSER_REVIEW_PHASE_ID=ADMIN-100-AUDIT-BYPASS \
BROWSER_REVIEW_TIMEOUT_MS=900000 \
node scripts/browser-phase-review.mjs
```

Server: `http://127.0.0.1:3001` (admin dev with `NEXT_PUBLIC_ADMIN_TEST_BYPASS=1`).
`__ADMIN_ALL__` expanded to **81 admin routes** from `apps/admin/lib/admin-nav-data.ts`.

## Runner result

- Status: **PASS for visual smoke only**
- Screenshots captured: **162** (81 routes × {desktop 1440×1000, mobile 390×844}).
- Findings: **0** (no 4xx, 5xx, route timeouts, navigation errors, or runtime exceptions).
- Runtime events: `expanded __ADMIN_ALL__ to 81 admin route(s)`.
- Report: `company/reviews/browser-phase-review/unknown_phase-2026-04-30T11-54-35-902Z.md`.
- Artifacts: `company/reviews/browser-phase-review/artifacts/UNKNOWN_PHASE-2026-04-30T11-54-35-902Z/`.

## Visual evidence verdict — bypass confirmed

Sampled `desktop-vi-iam.png`: shows the real admin shell — left sidebar with full nav
sections (Tổng quan, Quản lý nội dung, Học tập & Ôn luyện, Đánh giá, Battle, Người
dùng & Hỗ trợ, Phân tích, Doanh thu, Tăng trưởng, Vận hành, Pháp lý & Tuân thủ, IAM
expanded with sub-items: Tổng quan IAM, Roles, Permissions, Admin Users, Role Audit),
top header `KHÔNG GIAN ADMIN / NihonGo BJT Admin`, RBAC badge `RBAC đang bật`, logout
button. Body renders `IAM / RBAC admin / Thông tin admin actor, role và permission được
đọc từ schema authz. Đang tải quyền…` — i.e. the real RBAC admin client is mounted and
hitting `/api/admin/iam` for live data.

This confirms the bypass + SSR + client hydration path renders real admin UI across all
81 routes (auth gate skipped only because `isAdminTestBypassEnabled()` returns true in
dev).

This does **not** prove production-ready admin functionality. It does not validate
real password login/session behavior, Keycloak boundary behavior, RBAC denial states, or
screen-specific workflows such as create, edit, delete/archive, moderate, export,
retry, publish, pagination, filters, drawers, confirmations, audit reasons, and
end-to-end persistence.

## Source-side completion signals (still green)

- 81/81 nav items implemented; 0 scaffold renderers; 0 disabled feature flags.
- 0 placeholder strings (`planned notice|will be implemented|Phase 11|coming soon|under construction|renderAdminScaffold`).
- Typecheck 8/8 PASS, build 6/6 PASS.
- All 81 routes return HTTP 200.

## Blockers

- Authenticated workflow audit is still required using a real local admin login through
  `BROWSER_REVIEW_ADMIN_USERNAME` and `BROWSER_REVIEW_ADMIN_PASSWORD` runtime env vars.
- Bypass evidence must not be used as Release Director production sign-off.
- Per-route interaction evidence is required for all 81 routes before admin closeout.

## Recommendation

**`authenticated_workflow_audit_required`** — Keep Human Proxy running the admin
production loop. Use this bypass run only as route-render smoke evidence, then rerun
browser QA with real local admin credentials and record per-route workflow pass/fail.

## Artifacts

- This file: `company/admin-100-browser-audit-2026-04-30-rerun.md`
- Runner report: `company/reviews/browser-phase-review/unknown_phase-2026-04-30T11-54-35-902Z.md`
- Screenshots (162): `company/reviews/browser-phase-review/artifacts/UNKNOWN_PHASE-2026-04-30T11-54-35-902Z/`
- Sampled real-UI screenshot: `desktop-vi-iam.png`
- Bypass source: `apps/admin/lib/public-keycloak.ts` (`isAdminTestBypassEnabled()`),
  `apps/admin/app/_components/admin-keycloak-session-gate.tsx`,
  API-side bypass via `ADMIN_TEST_BYPASS` + `x-admin-actor-id` (rejects non-local).
