# Backend API Production Checklist

- [x] Backend API inventory audit created.
- [x] Backend API registry created.
- [ ] All endpoints registered and fully implemented.
- [ ] All controllers tagged in Swagger.
- [ ] All DTOs documented with complete response schemas.
- [ ] All validation decorators/classes present; current code still uses Zod for many DTOs.
- [x] Private endpoints added in this pass are protected by auth.
- [x] Admin endpoints added in this pass are protected by backend RBAC.
- [x] Admin writes added in this pass are audited with reason.
- [x] List endpoints added in this pass are paginated/max-limited where applicable.
- [ ] All mutation endpoints return consistent envelopes.
- [x] Common error schema is documented via reusable decorators.
- [ ] All uploads validated with MIME sniffing, size, extension allowlist, sanitization, and malware provider.
- [ ] All external fetches SSRF-protected.
- [ ] All premium/quota actions backend-enforced.
- [x] Admin operations APIs for feature flags/kill-switches/dead-letter-queue/import-staging/search-rebuild exist with RBAC and audit paths.
- [ ] All feature flags/kill-switches are backend-enforced across runtime paths.
- [x] OpenAPI docs generated to `docs/openapi.json`.
- [x] API tests passing for current suite.
- [x] No fake success placeholders introduced.
- [x] No MongoDB/Mongoose introduced.
- [x] No secrets added to repository.

Remaining production blockers are tracked in `docs/BACKEND_API_PRODUCTION_AUDIT.md`.

Runtime operations baseline truth:

- OpenAPI contains `/api/admin/operations/feature-flags`, `/api/admin/operations/kill-switches`, `/api/admin/operations/dead-letter-queue`, `/api/admin/operations/import-staging/errors`, and `/api/admin/operations/search-rebuild`.
- Current status is baseline management APIs present, including import-error triage into the real dead-letter queue and an admin-triggered search projection rebuild from PostgreSQL, while end-to-end runtime propagation/enforcement and worker replay remain partial.
