# Compact Spec 10: Testing and Acceptance

## Canonical references

Full spec sections: 18, 20, 21.4, 21.14, 23, 25.2.

## Test layers

Backend:
- unit tests for business logic
- integration tests for controllers/services/Prisma
- auth/RBAC tests for private/admin APIs
- quota/entitlement tests for monetized actions
- import idempotency and invalid-record tests
- queue/job tests where practical

Frontend:
- component tests where repo supports them
- route/page smoke tests
- i18n coverage for user-facing labels
- loading/error/empty/permission states
- accessibility checks for critical flows

E2E:
- auth/session
- content search/browse
- flashcard review
- quiz/mock exam
- admin mutation with audit
- privacy/consent/export/delete
- monetization gate/quota

## Security regression

Cover upload validation, SSRF rejection, auth/session hardening, RBAC bypass attempts, billing webhook verification, privacy masking, and share-page data leakage.

## Performance/load

Use targeted load checks for high-risk APIs, search, quiz, battle realtime, imports, and analytics rollups when nearing release.

## Acceptance gate

A feature is not done unless it has:
- real persistence or explicit provider abstraction
- DTO/contract validation
- error handling
- auth/RBAC where relevant
- i18n keys for user-facing copy
- audit logs for admin writes
- tests or explicitly documented test gap
- no fake in-memory persistent domain data

## Release gate

Before production release, verify:
- lint/typecheck/test/build
- migrations and seed/dev-data boundaries
- OpenAPI/API registry
- env validation and health checks
- privacy/security checklist
- backup/restore plan
- feature flags and kill switches
- known risks and owner for each residual risk

## Evidence format

For each gate, record:
- command run
- result
- relevant file/report path
- failure summary if failed
- risk level
- next owner/action

Do not mark pass when a command was skipped.

## Test selection by task

Backend API:
- controller/service tests
- DTO validation tests
- auth/RBAC denial tests
- OpenAPI/registry check

Database:
- Prisma generate
- migration validation/status
- seed/dev data boundary checks
- data migration tests when applicable

Admin UI:
- permission-aware rendering
- loading/error/empty states
- mutation form validation
- audit-backed API call behavior

Learner UI:
- route smoke tests
- persisted progress/review behavior
- mobile layout check
- reading assist/exam integrity where relevant
- learning focus and distraction checks where sensory/social features are changed
- media accessibility/provenance checks where audio/image/video/postcards are changed

Security/privacy:
- negative tests first
- data leakage checks
- consent/export/delete evidence

Growth/social:
- opt-in sharing
- privacy-safe public page and OG metadata
- no fake ranks/opponents/share stats
- fairness and anti-cheat checks for competition

Life in Japan/high-risk context:
- disclaimer/source/provenance/date checks
- no investment, lottery, legal, tax, housing, insurance, or immigration advice
- no fake financial outcomes
- no sensitive personal inference
- finance/gambling ethics gate evidence

## Gate retry rule

After a failed gate:
- fix only the likely cause
- rerun the targeted command
- after 2 targeted fixes without progress, escalate to deep-reasoning
- document remaining failure if blocked by environment
