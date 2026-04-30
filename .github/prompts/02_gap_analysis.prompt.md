# 02 — Gap Analysis Against v15 Spec

<context-hint>
Use when you need a comprehensive picture of what is missing compared with the canonical spec.
</context-hint>

<task>
Act as PM + Architect. Create a production gap analysis against the compact spec set. Read the full canonical spec only for unresolved conflicts.
</task>

<instructions>
1. Read `docs/spec/index.md`, `docs/spec/digests/boss_digest.md`, `docs/spec/compact/00_product_mvp_cutline.md`, `docs/spec/compact/01_architecture_stack.md`, `docs/spec/compact/02_database_prisma.md`, `docs/spec/compact/03_backend_api_registry.md`, `docs/spec/compact/05_admin_ui_modules.md`, `docs/spec/compact/07_security_privacy.md`, `docs/spec/compact/08_monetization.md`, `docs/spec/compact/09_operations_ci_cd.md`, and `docs/spec/compact/10_testing_acceptance.md`.
2. Inspect repo structure, package scripts, apps, Prisma, docs, CI.
3. Create/update `docs/V15_GAP_ANALYSIS.md`.
4. Update `company/COMPANY_BACKLOG.md` with P0/P1/P2/P3 tasks.
5. Do not implement code yet unless only creating docs.
</instructions>

<gap-report-sections>
- Current implemented modules
- Missing modules
- Partial modules
- Database gaps
- API gaps
- Admin UI gaps
- Learner UI gaps
- RBAC gaps
- OpenAPI gaps
- Test/CI gaps
- Security/privacy/legal gaps
- Monetization/quota gaps
- Feature flag gaps
- Recommended implementation order
</gap-report-sections>
