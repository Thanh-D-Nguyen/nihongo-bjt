# Compact Spec 03: Backend API Registry

## Canonical references

Full spec sections: 10, 10.1, 21.5 APIs, 21.7 APIs, 27.12, 28.8, 29.9.

## Registry rule

Every implemented backend endpoint must be represented in the canonical API registry/OpenAPI surface used by the repo. If a legacy `docs/BACKEND_API_REGISTRY.md` exists, keep it aligned or replace it with a generated/maintained equivalent through a documented decision.

## API requirements

- DTO validation for inputs.
- Typed responses or documented response contracts.
- OpenAPI/Swagger decorators for implemented endpoints.
- JWT auth for private APIs.
- Backend RBAC for admin APIs.
- Audit logs for admin mutations.
- Server-side entitlements/quotas for premium or limited actions.
- Explicit error handling; no silent catches or fake success.
- Tests for core business logic and critical controllers/services.

## Core API families

Auth/User:
- signup/login/logout/session/profile
- provider-based social auth and account linking
- privacy controls, consent, export/delete

Content:
- dictionary/kanji/grammar/examples browsing
- BJT levels and content drill-down
- bookmarks
- global search projection/fallback

Learning:
- flashcard decks/cards/SRS reviews
- study progress and achievements
- quiz/mock exam sessions, answers, results, remediation
- learning paths and placement/remediation
- reading assist parse/lookup/add-to-flashcard

Realtime/Battle:
- REST setup/history/reporting
- Socket.IO events for lobby, matching, room, answers, timers, results

Admin:
- dashboard and analytics
- user/support/user360 with privacy controls
- content CMS
- preset decks
- media library
- i18n admin
- quiz admin
- battle admin
- import center
- enrichment queue
- audit/IAM
- monetization, ads, billing, plans, entitlements, quotas
- share templates/referrals/analytics
- legal/consent/privacy operations

## OpenAPI and DTO coverage

- New endpoint without OpenAPI docs is incomplete.
- DTOs must reject invalid enums, missing required fields, unsafe URLs, invalid IDs, and unauthorized filters.
- Avoid leaking private fields in admin/support responses.

## When to read security compact

Also read `compact/07_security_privacy.md` for private/admin/upload/external-fetch/auth/billing/legal/privacy endpoints.

## Endpoint checklist

For each endpoint, record or verify:
- method and path
- owning module
- auth requirement
- permission or entitlement requirement
- request DTO
- response contract
- pagination/filter/sort constraints
- validation errors
- audit behavior for mutations
- idempotency needs
- OpenAPI coverage
- test coverage

## Pagination and filtering

- List endpoints must be bounded.
- Cursor pagination is preferred for large/high-churn datasets.
- Filters must be allowlisted.
- Sort fields must be allowlisted.
- Admin list endpoints must avoid leaking private fields by default.

## Error behavior

Use explicit errors for:
- unauthenticated
- unauthorized
- validation failure
- quota exceeded
- entitlement missing
- not found
- conflict
- degraded provider dependency

Do not return success when a mutation did not occur.

## API implementation order

1. Define domain model and persistence.
2. Define DTOs and response contracts.
3. Implement service logic with validation and permissions.
4. Add controller route and OpenAPI docs.
5. Add tests for success and failure cases.
6. Update registry/audit docs.
