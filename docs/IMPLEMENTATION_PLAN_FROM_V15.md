# Implementation Plan From V15

## Phase A: Spec Alignment and Project Safety

- Done in this pass: declare v15 canonical, add gap report, add this implementation plan, add required root scripts, add CI, add OpenAPI generation.
- Next: keep `docs/API_REGISTRY.md` synchronized with v15 Section 10 before new endpoint work.

## Phase B: Database and Schema Baseline

- Done in this pass: additive migration for canonical schemas, `pgcrypto`, `pg_trgm`, `unaccent`, l10n locale/translation tables, ops feature flags, feature flag audit, and dead-letter entries.
- Next: add learning path, legal consent, reading assist cache, known terms, content annotations, notification/email, and canonical outbox/checkpoint models.

## Phase C: RBAC and Auth Alignment

- Done in this pass: shared canonical v15 admin role constants and seed wiring for all required roles.
- Next: convert string-literal permission checks into shared decorators/guards and broaden tests.

## Phase D: API Registry and OpenAPI Baseline

- Done in this pass: `openapi:generate` script and CI command.
- Next: add complete DTO response decorators and machine-readable permission metadata to all controllers.

## Phase E: MVP V1 Vertical Slices

Finish in order:

1. Auth + profile + i18n parity with `/auth/profile`.
2. Dictionary search/detail/bookmark with v15 endpoint aliases.
3. Flashcard deck/card/SRS review including media abstraction and quota enforcement tests.
4. Quiz start/answer/result with clearly estimated BJT scoring and remediation links.
5. Admin content CRUD/audit with workflow status alignment.
6. Import profiler/staging/canonical import/outbox.
7. Meilisearch outbox worker/checkpoint/fallback tests.
8. Monetization free/standard seeds, entitlement catalog, and backend enforcement audit.
9. Production baseline: traceId logs, feature flag service, rate limits, security upload gates.

## Phase F and Later

Scaffold but do not fake user-facing completion for Learning Path Engine, Legal/Consent, Notifications, advanced Reading Assist, Social Growth endpoint parity, NHK news, achievements, and battle breadth.
