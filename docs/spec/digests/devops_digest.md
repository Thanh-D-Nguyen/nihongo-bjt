# DevOps Digest

Default tier: code-heavy. Escalate to deep-reasoning for production architecture, release gate, data safety, or security-sensitive infrastructure.

## Must read

- `docs/spec/index.md`
- `docs/spec/compact/09_operations_ci_cd.md`
- `docs/spec/compact/10_testing_acceptance.md`

## Conditional reads

- Security headers/secrets/privacy: `compact/07_security_privacy.md`
- DB migrations/backup: `compact/02_database_prisma.md`
- Jobs/search/realtime: `compact/01_architecture_stack.md`
- Monetization providers/webhooks: `compact/08_monetization.md`

## Done

- CI runs real project gates.
- Env validation fails fast for required production variables.
- Health checks are honest and expose degraded state.
- Feature flags/kill switches are centralized.
- Logs/metrics/tracing/dead-letter paths are documented or implemented.
- Backup/RPO/RTO and migration safety are addressed for release work.

## Avoid

- Hard-coded secrets.
- Always-OK health endpoints.
- CI commands that skip real checks.
- Provider config without failure/degraded behavior.

## Check commands

- Inspect package scripts and workflows.
- Run CI-equivalent local commands where feasible.
- Validate Docker/compose config if changed.
- Check env examples and startup validation.

## Escalate

Escalate when changing production deployment topology, data migration strategy, secrets handling, billing webhook infrastructure, or backup/restore policy.
