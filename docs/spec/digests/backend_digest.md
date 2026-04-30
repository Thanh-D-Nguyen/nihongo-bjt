# Backend Digest

Default tier: code-heavy. Escalate to deep-reasoning for architecture, RBAC/security, migrations on existing tables, billing/quota, or repeated test failures.

## Must read

- `docs/spec/index.md`
- `docs/spec/compact/01_architecture_stack.md`
- `docs/spec/compact/02_database_prisma.md`
- `docs/spec/compact/03_backend_api_registry.md`
- `docs/spec/compact/10_testing_acceptance.md`

## Conditional reads

- Admin endpoints: `compact/04_admin_rbac.md`
- Upload/external fetch/auth/privacy: `compact/07_security_privacy.md`
- Monetization/quota/billing/ads: `compact/08_monetization.md`
- Jobs/search/CI health: `compact/09_operations_ci_cd.md`

## Done

- DTO validation exists.
- API is authenticated/RBAC-gated where needed.
- Admin writes are audited.
- OpenAPI/API registry is updated.
- Prisma/database changes are migrated safely.
- Tests cover core behavior or test gap is documented.

## Avoid

- Fake success endpoints.
- Frontend-only premium/RBAC assumptions.
- Silent error swallowing.
- Raw SQL without reason.
- MongoDB/Mongoose.

## Check commands

- Inspect package scripts first: `find . -maxdepth 3 -name package.json -print`
- Prefer repo scripts for lint/typecheck/test/build.
- For Prisma changes, run generate/migration validation if scripts exist.

## Escalate

Escalate when endpoint semantics conflict with compact spec, auth/RBAC ownership is unclear, migration affects production data, or billing/webhook behavior is touched.
