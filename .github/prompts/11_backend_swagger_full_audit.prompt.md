# 11 — Backend Swagger Full Audit

<context-hint>
Use when you are unsure whether backend APIs and Swagger are 100% covered.
</context-hint>

<task>
Act as Backend + QA Agent. Verify every implemented backend route appears in Swagger/OpenAPI and every OpenAPI route maps to real code.
</task>

<instructions>
1. Read `docs/spec/index.md`, `docs/spec/digests/backend_digest.md`, and `docs/spec/compact/03_backend_api_registry.md`.
2. Inspect backend controllers and OpenAPI setup.
3. Generate OpenAPI JSON if possible.
4. Create/update `docs/BACKEND_SWAGGER_FULL_AUDIT.md`.
5. Fix one P0/P1 mismatch at a time.
</instructions>

<checks>
- Controller exists
- DTO exists
- Validation exists
- Swagger decorators complete
- Auth documented/enforced
- Permission documented/enforced
- Error schema documented
- Response schema documented
- No fake success
</checks>
