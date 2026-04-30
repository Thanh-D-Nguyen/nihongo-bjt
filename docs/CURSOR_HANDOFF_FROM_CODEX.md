# CURSOR_HANDOFF_FROM_CODEX.md

Handoff date: 2026-04-27 JST  
Canonical spec: `docs/spec/nihongo_bjt_cursor_master_spec_final_completed_v2.md` (v15)

## 1. What Codex Changed

- Added `docs/GAP_REPORT.md` before implementation work.
- Added `docs/SPEC_ALIGNMENT.md`, `docs/IMPLEMENTATION_PLAN_FROM_V15.md`, and `docs/API_REGISTRY.md`.
- Added required root scripts for Prisma migration, migration status, OpenAPI generation, and foundation seeding.
- Added CI workflow at `.github/workflows/ci.yml`.
- Added generated OpenAPI artifact and script: `apps/api/scripts/generate-openapi.ts` -> `apps/api/openapi/openapi.json`.
- Added additive Prisma migration `20260429100000_v15_foundation_alignment`.
- Added canonical schemas/extensions baseline, l10n locale/translation tables, ops feature flags, feature flag audit, and dead-letter entries.
- Added shared canonical v15 admin RBAC constants and wired admin seed to create all required roles.
- Added foundation seed for locales, translation namespaces, and feature flags.
- Updated monetization seed to preserve `plus` while adding v15 `standard` plan and baseline entitlement keys.

## 2. What Is Now Aligned With V15

- v15 is explicitly documented as canonical.
- Required scripts exist: `lint`, `typecheck`, `test`, `test:e2e`, `build`, `prisma:generate`, `prisma:migrate`, `openapi:generate`.
- CI can run install, Prisma generation/validation/status, lint, typecheck, test, OpenAPI generation, and build.
- Prisma datasource includes canonical schemas while preserving existing legacy schemas.
- Database migration creates `pgcrypto`, `pg_trgm`, `unaccent` and canonical schemas.
- Local DB has v15 foundation migration applied.
- Canonical admin roles exist in a shared source of truth and are seeded.
- Feature flag and dead-letter foundation tables exist.
- Locales `vi`, `ja`, `en` are seeded.

## 3. Remaining P1/P2/P3 Tasks

- P1: implement `/auth/profile` parity and profile CRUD/locale switching.
- P1: align dictionary/bookmark/flashcard endpoint paths with v15 aliases.
- P1: add feature flag service, operations admin APIs, kill switch enforcement, and tests.
- P1: complete import profiler -> staging -> canonical upsert -> outbox -> Meilisearch worker.
- P1: harden OpenAPI decorators with success/error DTOs on every endpoint.
- P1: add security hardening for upload validation, malware scan provider, SSRF protection, and rate limits.
- P1: add legal policy/consent/cookie consent models and APIs.
- P2: scaffold Learning Path Engine, notification/email provider, reading assist cache/known terms/content annotations.
- P2: align growth/social endpoint prefixes with v15 without breaking current share/referral flows.
- P3: NHK news, achievements, advanced battle breadth, advanced analytics.

## 4. Commands Run

- `pnpm install --frozen-lockfile` - passed.
- `pnpm prisma:generate` - passed.
- `pnpm prisma:validate` - passed.
- `pnpm prisma:migrate` - applied `20260429100000_v15_foundation_alignment`; Prisma then prompted for a new migration due dev-mode behavior, so the interactive process was killed after the intended migration applied.
- `pnpm prisma:migrate:check` - passed; database schema is up to date.
- `pnpm lint` - passed with one pre-existing warning in `apps/api/scripts/seed-ads-defaults.ts`.
- `pnpm typecheck` - passed.
- `pnpm test` - passed, 18 files / 61 tests.
- `pnpm openapi:generate` - passed.
- `pnpm seed:foundation` - passed.
- `pnpm build` - passed. Next.js warns about workspace root inference because `/Users/thanhnguyen/package-lock.json` exists above the repo.

## 5. Known Risks

- This directory is not a Git repository, so file tracking was manual.
- The existing schema still uses legacy namespaces such as `monetization`, `profile`, and `authz`; do not rename/drop these without a dedicated migration plan.
- The new foundation migration is additive and safe, but production deploy should use `prisma migrate deploy`, not interactive `migrate dev`.
- `apps/api/openapi/openapi.json` is generated and should be refreshed after controller changes.
- Runtime feature flags are stored but not yet enforced by a service/guard.

## 6. Suggested Next Cursor Prompts

1. “Using v15 and `docs/API_REGISTRY.md`, implement `/auth/profile` POST/GET/PUT as aliases over the existing learner profile model with DTOs, OpenAPI decorators, tests, and i18n-safe frontend usage.”
2. “Add a backend FeatureFlagService with kill-switch enforcement for media/import/external-provider flows, plus admin operations APIs and tests.”
3. “Align dictionary and bookmark endpoints with v15 aliases without breaking existing `/content` and `/search` clients.”
4. “Implement import outbox and Meilisearch checkpoint worker with degraded PostgreSQL fallback tests.”

## 7. Files Modified

- `.github/workflows/ci.yml`
- `package.json`
- `apps/api/package.json`
- `apps/api/scripts/generate-openapi.ts`
- `apps/api/scripts/seed-admin.ts`
- `apps/api/scripts/seed-foundation.ts`
- `apps/api/scripts/seed-monetization.ts`
- `apps/api/openapi/openapi.json`
- `packages/database/prisma/schema.prisma`
- `packages/database/prisma/migrations/20260429100000_v15_foundation_alignment/migration.sql`
- `packages/shared/src/admin-rbac.ts`
- `packages/shared/src/admin-rbac.js`
- `packages/shared/src/index.ts`
- `docs/SPEC_ALIGNMENT.md`
- `docs/GAP_REPORT.md`
- `docs/IMPLEMENTATION_PLAN_FROM_V15.md`
- `docs/API_REGISTRY.md`
- `docs/CURSOR_HANDOFF_FROM_CODEX.md`

## 8. Migration Notes

- Migration is additive only: schemas, extensions, l10n tables, feature flags, feature flag audit, dead-letter entries, and seed rows.
- Existing tables and data are not dropped or renamed.
- Local migration status is clean after applying `20260429100000_v15_foundation_alignment`.

## 9. Test Status

Current status is green for the requested baseline commands, with warnings only:

- Lint warning: unused eslint-disable in `apps/api/scripts/seed-ads-defaults.ts`.
- Build warning: Next.js workspace root inference due an ancestor `package-lock.json`.
