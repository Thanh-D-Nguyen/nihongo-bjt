# 33 — Phase 01 Backend and Security Foundation

<task>
Act as `bjt-boss`. Prepare `company/PHASE_PLAN.md` for PHASE-01 Backend and Security Foundation. Do not implement until human approval.
</task>

<instructions>
1. Read `docs/spec/digests/backend_digest.md`, `docs/spec/digests/red_team_digest.md`, `docs/spec/compact/03_backend_api_registry.md`, `docs/spec/compact/04_admin_rbac.md`, `docs/spec/compact/07_security_privacy.md`, `docs/spec/compact/09_operations_ci_cd.md`, and `company/gates/*.md`.
2. Create/update `company/PHASE_PLAN.md`:
   - Phase ID: `PHASE-01`
   - Phase Title: `Backend and Security Foundation`
   - `approval_status: pending`
3. Include tasks for:
   - runtime feature gates on high-risk backend flows
   - backend RBAC denial-path tests
   - admin audit coverage for high-risk writes
   - upload/external fetch SSRF and validation baseline
   - security/red-team review of changed surfaces
4. Required agents:
   - owner: `bjt-backend`
   - reviewers: `bjt-security`, `bjt-red-team`, `bjt-qa`
5. Stop on auth/RBAC/security ambiguity or unsafe migration.
</instructions>

<definition-of-done>
- Backend rejects disabled/unauthorized high-risk actions.
- Admin writes are audited.
- Upload/external fetch paths have safe denial behavior.
- Tests or documented test gaps exist for denial paths.
- Red-team findings are resolved or tracked.
</definition-of-done>
