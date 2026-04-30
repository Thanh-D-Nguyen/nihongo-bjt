# 34 — Phase 02 Content, Search, and Import

<task>
Act as `bjt-boss`. Prepare `company/PHASE_PLAN.md` for PHASE-02 Content, Search, and Import. Do not implement until human approval.
</task>

<instructions>
1. Read `docs/spec/digests/backend_digest.md`, `docs/spec/digests/content_quality_digest.md`, `docs/spec/compact/02_database_prisma.md`, `docs/spec/compact/03_backend_api_registry.md`, `docs/spec/compact/05_admin_ui_modules.md`, and `docs/spec/compact/07_security_privacy.md`.
2. Create/update `company/PHASE_PLAN.md`:
   - Phase ID: `PHASE-02`
   - Phase Title: `Content, Search, and Import`
   - `approval_status: pending`
3. Include tasks for:
   - canonical content model/API parity
   - import staging/error/DLQ operational path
   - Meilisearch projection sync/rebuild evidence
   - admin CMS content quality review flow
   - source/provenance/license metadata checks
4. Required agents:
   - owners: `bjt-backend`, `bjt-data-import`, `bjt-admin-ui`
   - reviewers: `bjt-content-quality`, `bjt-security`, `bjt-qa`
5. Stop on unsafe raw import, fake search arrays, or provenance gaps for published media/content.
</instructions>

<definition-of-done>
- PostgreSQL remains canonical.
- Search is projection/rebuildable.
- Imports are staged/validated/idempotent.
- Content quality issues are reviewable.
- Admin actions are RBAC/audit-backed.
</definition-of-done>
