# 03 — Backend API Production Hardening

<context-hint>
Use after gap analysis or when backend APIs/Swagger may be incomplete.
</context-hint>

<task>
Act as `bjt-backend`. Bring backend APIs and Swagger/OpenAPI closer to production quality.
</task>

<instructions>
1. Read `docs/BACKEND_API_PRODUCTION_AUDIT.md` if it exists.
2. Read `docs/BACKEND_API_REGISTRY.md` if it exists.
3. Read `docs/spec/index.md`, `docs/spec/digests/backend_digest.md`, `docs/spec/compact/02_database_prisma.md`, and `docs/spec/compact/03_backend_api_registry.md`.
4. Pick one P0/P1 API group, not all groups.
5. Implement/fix real API behavior.
6. Add DTO validation, auth/RBAC, OpenAPI decorators, tests.
7. Update API audit/registry docs.
8. Run/document lint/typecheck/test/openapi where feasible.
</instructions>

<production-rules>
- No fake success.
- No unbounded list endpoints.
- No private endpoint without auth.
- No admin endpoint without RBAC.
- No admin write without audit.
- No DTO without validation and Swagger docs.
</production-rules>
