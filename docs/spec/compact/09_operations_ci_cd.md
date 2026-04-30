# Compact Spec 09: Operations, CI/CD, and Runtime

## Canonical references

Full spec sections: 16, 21.13, 30.

## Services

Expected runtime services include:
- app/API
- frontend(s)
- PostgreSQL
- Redis
- Meilisearch
- background workers
- optional object storage/CDN provider abstractions

## Feature flags and kill switches

- Use centralized feature flags for incomplete/risky modules.
- Kill switches must disable unsafe external integrations, ads, billing providers, imports, notifications, and heavy jobs.
- Flags must not create fake production success.

## Health checks

Health endpoints must be honest:
- liveness for process
- readiness for database/cache/search/provider dependencies where relevant
- degraded states instead of always-OK responses

## Observability

Instrument:
- structured logs
- request/job correlation IDs
- metrics for API latency/errors, DB, queues, search sync, imports, billing, ads, auth, quizzes, battle, reading assist, learning paths
- tracing where stack supports it
- dead-letter queues and failed job recovery

## CI/CD

CI should run real gates:
- install
- lint
- typecheck
- unit/integration tests
- build
- Prisma generate/migration validation where applicable
- OpenAPI generation/contract check where applicable
- security/static checks where available

Do not add CI greenwashing commands that skip the real project checks.

## Backup and recovery

Define backup, restore test, RPO/RTO targets, migration safety, and rollback/forward-fix practices for production data.

## Resilience

Use caching, rate limits, pagination, circuit breakers, connection pooling, and retry policies where needed. External integrations must fail closed or degrade safely.

## Env validation checklist

- Required production variables are declared.
- Missing required variables fail startup.
- Optional variables have safe defaults.
- Secrets are not printed.
- Local/dev providers are explicit.
- Example env files do not contain real secrets.

## Feature flag checklist

Flags should define:
- key
- owner/module
- default state
- environment behavior
- kill-switch behavior
- admin visibility/edit permission
- audit behavior for changes

## Queue checklist

Jobs should define:
- queue name
- payload schema
- idempotency strategy
- retry/backoff
- timeout
- dead-letter behavior
- metrics/logging
- admin/operator visibility

## Health/readiness checklist

Readiness should check:
- database connectivity
- Redis connectivity when queues/realtime need it
- Meilisearch connectivity when search is required
- provider degraded state where applicable
- migration compatibility where supported

## Release ops checklist

- CI green on real gates.
- Migrations reviewed.
- Backup/restore plan exists.
- Feature flags configured.
- Health/readiness verified.
- Observability dashboards or logs documented.
- Known operational risks recorded.
