# GAP_REPORT.md

Audit date: 2026-04-27 JST  
Canonical source: `docs/spec/nihongo_bjt_cursor_master_spec_final_completed_v2.md` (v15)

## 1. Current Implemented Modules

- P0/P1 partial: NestJS API, Next.js learner app, Next.js admin app, Turborepo, Prisma package.
- P0 partial: Keycloak-ready auth guard/session flow, local admin actor fallback, profile sync/user profile tables.
- P1 partial: canonical content import tables, content browsing, search API with Meilisearch indexing script and PostgreSQL fallback service.
- P1 partial: flashcards/decks/SRS models, APIs, learner UI, SM-2 scheduling utility and tests.
- P1 partial: quiz template/session/question/answer/result flow with estimated BJT score/band helper and tests.
- P1 partial: admin content CRUD, admin user support views, audit log, RBAC service.
- P1 partial: analytics events/rollups, admin analytics screens.
- P2 partial: battle REST/gateway/session tables.
- P2 partial: daily life hub.
- P2 partial: monetization plans/entitlements/quotas/subscriptions/ads providers/admin UI.
- P2 partial: social growth/share/referral models and endpoints.
- P2 partial: reading assist analyzer/preferences/admin reports.
- P0 partial: health checks, Helmet, CORS allowlist, Swagger UI.

## 2. Missing Modules

- P0: canonical v15 API registry document outside the spec.
- P0: CI workflow was absent before this audit.
- P0: root `prisma:migrate`, migration check, and `openapi:generate` scripts were absent.
- P0: canonical l10n schema/tables were absent.
- P0: canonical ops feature flag/dead-letter tables were absent.
- P1: Learning Path Engine contracts and schema are missing.
- P1: legal policy/consent/cookie consent schema and APIs are missing or only represented by privacy request profile tables.
- P1: notification/email provider contracts are incomplete.
- P1: import canonical upsert/outbox worker is incomplete.
- P1: OpenAPI coverage is incomplete across controllers.
- P2: NHK news provider and analysis workflow are missing.
- P2: achievement/quest system is missing.
- P2: production malware scan provider and SSRF-safe external fetch layer are missing.

## 3. Partially Implemented Modules

- P0: RBAC exists, but permission constants were not a complete v15 source of truth and role seeding did not cover every canonical role.
- P0: OpenAPI exists through Swagger UI, but generation was not scriptable/CI-enforced.
- P0: environment validation exists, but security hardening variables for upload scanning, risky flow disabling, CSRF policy, and rate limits are incomplete.
- P1: dictionary schema is older/simple and does not fully match normalized v15 `lexeme_form`, `sense_gloss`, `sense_tag`, `content_source`.
- P1: admin content workflow uses `active/archived/needs_review`; v15 wants draft/review/publish/archive semantics where applicable.
- P1: search indexing is batch script based; v15 requires outbox worker/checkpoints/degraded fallback.
- P1: monetization uses `monetization` schema and `plus` seed; v15 names canonical schema `billing` and recommends free/standard baseline.
- P1: learner/auth endpoints use `/auth/me` and `/learner/*`; v15 also expects `/auth/profile` CRUD shape.
- P2: reading assist works as a reusable API, but cache/known-term/content annotation models are missing.
- P2: growth has Google OAuth/share/referral pieces, but endpoint prefixes differ from v15 `/auth/oauth/*`, `/referrals/*`, `/share/*`.

## 4. Database Schema Gaps

- P0: canonical schemas `curriculum`, `iam`, `billing`, `legal`, `l10n` were not declared in Prisma datasource.
- P0: `pg_trgm` and `unaccent` extensions were not guaranteed in migrations.
- P0: feature flag and dead-letter queue tables were missing.
- P1: content schema lacks several v15 normalized tables (`content_source`, `lexeme_form`, `sense_gloss`, `sense_tag`, `kanji_reading`, localized grammar/example tables).
- P1: learning path tables are missing.
- P1: legal policy/consent/cookie tables are missing.
- P1: notification/email event tables are missing.
- P1: outbox/checkpoint models are not fully represented.
- P2: partition-ready parent tables are not consistently implemented for append-heavy events.

## 5. Prisma Model Gaps

- P0: no Prisma models for `l10n.locale`, `translation_key`, `translation_value`.
- P0: no Prisma models for `ops.feature_flag`, `feature_flag_audit`, `dead_letter_entry`.
- P1: no Learning Path Engine models.
- P1: no legal/consent models.
- P1: missing reading assist cache/known term/content annotation models.
- P1: missing canonical billing-named models; existing monetization models should be migrated carefully, not duplicated blindly.
- P2: no notification/email event/provider config models.

## 6. API Endpoint Gaps

- P0: no central API registry document generated from v15 Section 10.
- P1: `/auth/profile` POST/GET/PUT endpoints are missing or mapped differently.
- P1: dictionary endpoints use `/content/*` and `/search`; v15 expects `/dictionary/search`, `/dictionary/words/:id`, `/kanji/*`, `/grammar/*`, `/examples/*`, `/vija/search`.
- P1: bookmark endpoints are missing.
- P1: flashcard endpoint paths differ from v15 `/decks`, `/review`, `/flashcards/cards/:id/images/*`.
- P1: import admin endpoints are missing/incomplete.
- P1: operations endpoints for feature flags, kill switches, DLQ are missing.
- P1: legal/consent/privacy endpoint family is incomplete.
- P2: learning path endpoint family is missing.
- P2: notification admin endpoints are missing.

## 7. Admin UI Gaps

- P0: admin UI has permission-aware shell pieces, but not a complete v15 RBAC matrix view.
- P1: feature flag/kill switch/DLQ operations screens are missing.
- P1: import governance UI is incomplete.
- P1: admin i18n editor is missing.
- P1: legal/compliance screens are missing.
- P1: canonical monetization screen exists but should align plan names, billing schema terminology, audit, and provider status.
- P2: learning path builder/admin analytics missing.

## 8. Learner UI Gaps

- P1: profile CRUD and locale switching are incomplete relative to `/auth/profile`.
- P1: dictionary detail and bookmarks are incomplete.
- P1: flashcard image selection/upload/search UX is incomplete.
- P1: quiz remediation links need hardening.
- P1: upgrade/paywall UX must continue to be backed by server entitlements.
- P2: learning paths, achievements, legal consent, notifications, and refined reading assist preferences are incomplete.

## 9. RBAC/Permission Gaps

- P0: canonical v15 role list was not fully seeded before this audit.
- P0: backend checks exist but use string literals in controllers; decorators/guards should centralize permission metadata.
- P1: admin route coverage should be audited endpoint by endpoint.
- P1: super-role wildcard behavior should be explicit in service tests.
- P1: permission-aware rendering in admin should import the same shared constants used by seeds/API.

## 10. OpenAPI/Swagger Gaps

- P0: Swagger UI exists, but no checked-in/generated OpenAPI artifact or CI command.
- P1: many routes have tags and operation summaries, but incomplete request/response DTO decorators.
- P1: validation error schema is documented globally but not consistently attached to every route.
- P1: auth and permission requirements are often in descriptions, not machine-readable metadata.

## 11. Test Coverage Gaps

- P0: no CI baseline existed before this audit.
- P1: RBAC guard/service tests need broader coverage.
- P1: admin audit before/after behavior needs tests.
- P1: entitlement/quota enforcement tests need end-to-end API coverage.
- P1: feature flag enforcement tests missing.
- P1: import profiler idempotency tests incomplete.
- P1: Meilisearch fallback behavior tests incomplete.
- P1: upload validation/malware provider/API validation tests missing.

## 12. CI/CD and Production Baseline Gaps

- P0: no `.github/workflows/ci.yml` was present.
- P0: required scripts missing before this audit: `prisma:migrate`, `prisma:migrate:check`, `openapi:generate`.
- P1: deploy pipeline, zero-downtime migration policy, backup/restore automation, and RPO/RTO checks are not automated.
- P1: structured logs exist only partially through Nest logging; traceId propagation needs a middleware/interceptor.
- P1: rate limiting is not wired.

## 13. Security/Privacy/Compliance Gaps

- P0: Helmet and CORS are present.
- P1: CSRF/session-cookie policy needs explicit implementation and docs.
- P1: upload validation is incomplete: MIME sniffing, extension allowlist, SVG sanitization, and image sanitization should be enforced centrally.
- P1: MalwareScanProvider interface/provider selection missing.
- P1: SSRF protection for external URL fetches missing.
- P1: brute-force/rate-limit protection for auth-sensitive endpoints missing.
- P1: policy version, consent, cookie consent, and privacy request fulfillment flows incomplete.

## 14. Monetization/Entitlement/Quota Gaps

- P0/P1: central entitlement/quota services exist, but route-by-route enforcement must be audited.
- P1: seeds should align with v15 free/standard baseline and entitlement key catalog.
- P1: schema currently uses `monetization`; v15 names `billing`. Migrate with views/aliases or careful rename plan later.
- P1: no fake premium UI should be added; existing admin/learner UX must stay server-driven.
- P2: external billing/ad provider production readiness remains deferred behind providers.

## 15. Feature Flag / Kill Switch Gaps

- P0: feature flag table and seed were missing before this audit.
- P1: no shared FeatureFlagService or guard/interceptor is wired into routes.
- P1: kill switches are not enforced for risky media/import/external-provider flows.
- P1: admin operations UI/API for flags and DLQ is missing.

## 16. Recommended Implementation Order

1. P0: land docs, canonical v15 alignment note, CI, required scripts, OpenAPI generation, canonical schema/extension/feature-flag/l10n migration, canonical RBAC seed constants.
2. P0: run `pnpm install`, `pnpm prisma:generate`, `pnpm prisma:validate`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm openapi:generate`, `pnpm build`.
3. P1: add central API registry doc and endpoint parity plan; do not create new controllers without registry updates.
4. P1: finish auth/profile/i18n and dictionary/detail/bookmark vertical slices.
5. P1: harden flashcards/SRS, quiz remediation, admin content workflow/audit tests.
6. P1: implement import profiler/staging/canonical upsert/outbox and Meilisearch worker/checkpoint fallback.
7. P1: implement feature flag service, operations admin APIs, and kill-switch enforcement.
8. P1: implement security hardening: upload validation, malware provider interface, SSRF guard, rate limits, traceId logs.
9. P1: align monetization seeds and enforcement; defer external provider integration.
10. P2: scaffold learning path, legal/consent, notifications, reading assist cache/known terms, and growth endpoint prefix alignment with real contracts and feature flags.
