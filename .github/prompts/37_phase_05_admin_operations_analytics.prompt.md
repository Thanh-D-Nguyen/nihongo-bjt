# 37 — Phase 05 Admin, Operations, and Analytics

<task>
Act as `bjt-boss`. Prepare `company/PHASE_PLAN.md` for PHASE-05 Admin, Operations, and Analytics. Do not implement until human approval.
</task>

<instructions>
1. Read `docs/spec/digests/admin_ui_digest.md`, `docs/spec/digests/devops_digest.md`, `docs/spec/compact/04_admin_rbac.md`, `docs/spec/compact/05_admin_ui_modules.md`, `docs/spec/compact/09_operations_ci_cd.md`, and `company/product/north-star-metrics.md`.
2. Create/update `company/PHASE_PLAN.md`:
   - Phase ID: `PHASE-05`
   - Phase Title: `Admin, Operations, and Analytics`
   - `approval_status: pending`
3. Include tasks for:
   - admin module contract parity
   - User 360/support privacy boundary
   - feature flag/dead-letter/admin operations pages
   - real analytics events/rollups and dashboard states
   - admin loading/error/empty/permission states
4. Required agents:
   - owners: `bjt-admin-ui`, `bjt-backend`
   - reviewers: `bjt-security`, `bjt-customer-success`, `bjt-qa`
5. Stop on fake charts, UI-only RBAC, unaudited admin writes, or privacy overexposure.
</instructions>

<definition-of-done>
- Admin pages use real APIs or honest disabled states.
- Permissions are server-enforced.
- Analytics are backed by real events/rollups.
- Support access is audited/privacy-minimized.
</definition-of-done>
