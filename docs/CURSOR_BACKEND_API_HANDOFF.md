# Cursor Backend API Handoff

Handoff date: 2026-04-27 JST  
Final verification pass: 2026-04-27 22:16 JST  
Scope: backend API production-readiness pass against v15.

## 1. Summary of Backend API Status

The backend now has a formal API production audit and registry, generated OpenAPI output in `docs/openapi.json`, and several missing P0/P1 canonical endpoints implemented as real database-backed APIs rather than placeholders.

The codebase still is not 100% v15 complete. Remaining work is concentrated in legal/consent, import/outbox worker APIs, admin quiz/preset/import builders, advanced Swagger DTO coverage, upload malware/SSRF hardening, and deeper controller/integration tests.

## 2. Endpoints Completed Or Improved

- `POST /auth/profile`, `GET /auth/profile`, `PUT /auth/profile`
- `GET /dictionary/search`, `GET /dictionary/words/:id`
- `GET /kanji`, `GET /kanji/search`, `GET /kanji/:id`
- `GET /grammar`, `GET /grammar/:id`
- `GET /examples`, `GET /examples/search`, `GET /examples/by-word/:wordId`
- `GET /vija/search`
- `GET /bookmarks/check/:type/:id`, `POST /bookmarks/:type/:id`, `GET /bookmarks/words|kanji|grammar`
- `GET /decks`, `POST /decks`, `GET /decks/:id`, `GET /decks/:deckId/cards`, `POST /decks/:deckId/cards`
- `GET /review/next`, `POST /review`, `GET /review/summary`
- `GET/PATCH /admin/operations/feature-flags`
- `GET/PATCH /admin/operations/kill-switches`
- `GET/PATCH /admin/operations/dead-letter-queue`

## 3. Endpoints Still Partial

- Deck update/delete, preset decks, clone, remove-card.
- Flashcard image search/candidates/select and malware-safe upload enforcement.
- Quiz abandon/history and quota enforcement on quiz start.
- Search fallback response metadata (`degraded: true`) is not yet in the contract.
- Admin content v15 word-specific route aliases are still generic under `/admin/content`.
- Operations DLQ retry behavior is not wired to workers yet.

## 4. Intentionally Deferred

- Learning Path Engine APIs.
- Broader legal/privacy/cookie API family beyond baseline consent status/accept endpoints.
- Billing webhooks/cancel/refund APIs.
- Notification admin APIs.
- NHK provider APIs.
- Achievements APIs.
- Full battle REST/realtime parity.

## 5. Swagger/OpenAPI Generation Status

- `pnpm openapi:generate` passes.
- Generated files:
  - `apps/api/openapi/openapi.json`
  - `docs/openapi.json`
- Added OpenAPI generation test that asserts canonical paths are registered.
- Final verification found **165 decorated backend controller methods** and **165 generated OpenAPI operations**.
- Final verification found **147 OpenAPI paths**, and every generated operation has a success/redirect response plus an error response documented.
- Fixed missing success response metadata on existing Auth, Admin, Content, and Search controller groups before regenerating `docs/openapi.json`.
- New endpoints have tags, operations, common error docs, and several response DTOs. Older controllers still need full property-level response DTO coverage.

## 6. Test Status

Passing:

- `pnpm test`: 20 files, 64 tests.
- Added schema contract tests for auth profile and bookmark params.
- Added OpenAPI generation test.

Still needed:

- Controller tests for JWT/auth rejection and response contracts.
- DB integration tests for bookmarks, profile update, operations audit logs.
- Feature flag enforcement tests once runtime enforcement service is wired into feature-gated flows.

## 7. Known Risks

- This workspace is not a Git repository, so changes were tracked manually.
- Existing shared package has `.js` runtime mirrors alongside `.ts`; new shared exports were mirrored manually to keep Next/Turbopack builds working.
- Most validation still uses Zod, not class-validator DTO classes. This is consistent with current repo patterns but not yet the full requested DTO standard.
- OpenAPI route coverage is complete for implemented HTTP controllers, but some legacy responses are still documented generically instead of with precise response DTO classes.
- Feature flags can be managed in the backend now, but application flows do not yet enforce every feature flag/kill switch.
- Monetization quota enforcement exists for the SRS review loop and quiz start (`quiz.bjt.start`) through `QuotaService`; deck/card creation and other premium actions still need endpoint-level quota/entitlement enforcement before paid launch.
- Upload/media flows have validation contracts, but production malware scanning and deeper SSRF hardening remain incomplete.
- Build still warns about Next.js workspace root inference due `/Users/thanhnguyen/package-lock.json` above the repo.
- Lint still reports one existing warning in `apps/api/scripts/seed-ads-defaults.ts`.

## 8. Next Cursor Prompts

1. “Add controller/integration tests for `/auth/profile`, `/bookmarks/*`, and `/admin/operations/*`, including auth rejection and audit log assertions.”
2. “Implement feature flag runtime enforcement service and gate external media upload/import/reading-assist/billing flows using existing `ops.feature_flag`.”
3. “Add legal/consent/cookie consent schema and `/legal/*`, `/consent/*` APIs with no signup/payment bypass.”
4. “Finish canonical flashcard/deck endpoints: update/delete deck, preset deck list/clone, remove card, and idempotency key on review submit.”
5. “Upgrade OpenAPI DTO coverage endpoint-by-endpoint, replacing generic Zod descriptions with concrete request/response DTO classes.”

## 9. Files Changed

- `docs/BACKEND_API_PRODUCTION_AUDIT.md`
- `docs/BACKEND_API_REGISTRY.md`
- `docs/BACKEND_API_PRODUCTION_CHECKLIST.md`
- `docs/CURSOR_BACKEND_API_HANDOFF.md`
- `docs/openapi.json`
- `apps/api/openapi/openapi.json`
- `apps/api/scripts/generate-openapi.ts`
- `apps/api/scripts/seed-admin.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/admin/admin-auth.service.ts`
- `apps/api/src/auth/auth.controller.ts`
- `apps/api/src/bookmarks/*`
- `apps/api/src/content/canonical-content.controller.ts`
- `apps/api/src/content/content.controller.ts`
- `apps/api/src/content/content.module.ts`
- `apps/api/src/content/content.repository.ts`
- `apps/api/src/flashcards/canonical-flashcards.controller.ts`
- `apps/api/src/flashcards/flashcards.module.ts`
- `apps/api/src/flashcards/flashcards.repository.ts`
- `apps/api/src/keycloak/keycloak-user.service.ts`
- `apps/api/src/openapi/dto/backend-api-openapi.dto.ts`
- `apps/api/src/openapi/openapi-generation.test.ts`
- `apps/api/src/openapi/setup-swagger.ts`
- `apps/api/src/operations/*`
- `apps/api/src/search/search.controller.ts`
- `packages/database/prisma/schema.prisma`
- `packages/database/prisma/migrations/20260429120000_bookmarks_api_foundation/migration.sql`
- `packages/shared/src/index.ts`
- `packages/shared/src/index.js`
- `packages/shared/src/backend-api-contracts.test.ts`

## 10. Migration Notes

- Added `learning.bookmark`.
- Applied migration with non-interactive `prisma migrate deploy`.
- Local `pnpm prisma:migrate:check` reports database schema is up to date.
- Existing tables were not dropped or renamed.

## 11. Manual Setup Required

- Run `pnpm seed:foundation` after migrations in local/dev to ensure admin roles/permissions, locales, feature flags, and monetization baseline are present.
- Production should use `prisma migrate deploy`, not interactive `prisma migrate dev`.

## 12. Verification Results

- `pnpm install --frozen-lockfile`: passed in earlier backend pass; not rerun during final verification.
- `pnpm prisma:generate`: passed on 2026-04-27 22:16 JST.
- `pnpm prisma:migrate:check`: passed in earlier backend pass; no migration changes in final verification.
- `pnpm seed:foundation`: passed in earlier backend pass; no seed changes in final verification.
- `pnpm lint`: passed on 2026-04-27 22:15 JST with one existing warning in `apps/api/scripts/seed-ads-defaults.ts`.
- `pnpm typecheck`: passed on 2026-04-27 22:15 JST.
- `pnpm test`: passed on 2026-04-27 22:15 JST, 20 files / 64 tests.
- `pnpm openapi:generate`: passed on 2026-04-27 22:14 JST.
- `pnpm build`: passed on 2026-04-27 22:16 JST with existing Next.js workspace-root warnings.

## 13. Final Backend API Verification

- Every implemented decorated HTTP controller method is present in `docs/openapi.json`: 165 controller methods / 165 OpenAPI operations.
- Every OpenAPI operation maps back to a real controller method; no generated-only routes were found.
- Private routes document bearer auth where used and enforce auth through `KeycloakAuthGuard`, admin session services, or controller-level admin principal checks.
- Admin routes document admin security and enforce permissions through `AdminAuthService.requirePermission` / `requireOneOfPermissions`.
- Request bodies, query objects, and path params are validated through existing Zod/shared schema patterns. This remains a repo-pattern-compatible implementation, not full class-validator DTO parity.
- Every OpenAPI operation now has documented success/redirect and error responses.
- P0/P1 APIs implemented in this pass are database/service-backed; no dummy user-facing success endpoint was introduced.
- Admin write paths implemented in the current backend pass route through repository/service methods that create audit rows where the domain supports writes.
- No MongoDB/Mongoose dependency or database path was introduced.
