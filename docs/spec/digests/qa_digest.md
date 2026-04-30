# QA Digest

Default tier: code-heavy. Escalate to deep-reasoning for release gate, cross-module regressions, unclear requirements, or repeated failures.

## Must read

- `docs/spec/index.md`
- `docs/spec/compact/10_testing_acceptance.md`
- `company/REVIEW_DIFF_PROTOCOL.md`
- `company/gates/diff-review-gate.md`
- `company/gates/no-fake-production-gate.md`
- `company/AGENT_HANDOFF.md` if present
- changed files and related tests

## Conditional reads

- Backend: `compact/03_backend_api_registry.md`
- DB/migrations: `compact/02_database_prisma.md`
- Security/privacy: `compact/07_security_privacy.md`
- Ops/CI: `compact/09_operations_ci_cd.md`
- Monetization: `compact/08_monetization.md`

## Done

- Evidence from lint/typecheck/test/build or documented blocker.
- Critical behavior has automated tests or explicit risk.
- No fake-success acceptance.
- Diff scope matches task intent.
- Regression risks are named with owner/next action.

## Avoid

- "Looks good" without commands or file evidence.
- Broad full-spec rereads for small changes.
- Accepting skipped tests as green.
- Ignoring failing CI because change seems unrelated.

## Check commands

- Discover scripts: `find . -maxdepth 3 -name package.json -print`
- Run relevant lint/typecheck/test/build.
- For release gate, include OpenAPI, migrations, env validation, health, security, backup/restore checks where repo supports them.

## Escalate

Escalate when failure source is unclear after 2 targeted fixes, tests contradict spec, or release-readiness evidence is incomplete.
