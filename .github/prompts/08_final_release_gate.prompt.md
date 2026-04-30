# 08 — Final Release Gate

<context-hint>
Use when you think MVP v1 is ready or before a major handoff.
</context-hint>

<task>
Act as `bjt-qa`, `bjt-red-team`, and `bjt-release-director`. Perform a production readiness gate and ship/no-ship decision.
</task>

<instructions>
1. Read `docs/spec/index.md`, `docs/spec/digests/qa_digest.md`, `docs/spec/digests/red_team_digest.md`, `docs/spec/digests/release_director_digest.md`, `docs/spec/digests/learning_experience_digest.md`, `docs/spec/digests/life_in_japan_digest.md`, `docs/spec/compact/00_product_mvp_cutline.md`, `docs/spec/compact/03_backend_api_registry.md`, `docs/spec/compact/07_security_privacy.md`, `docs/spec/compact/08_monetization.md`, `docs/spec/compact/09_operations_ci_cd.md`, `docs/spec/compact/10_testing_acceptance.md`, `docs/spec/compact/11_learning_effectiveness_experience.md`, and `docs/spec/compact/12_life_in_japan_contexts.md`.
2. Read `company/gates/*.md` and `company/product/north-star-metrics.md`.
3. Read company state, backlog, handoff, latest audits.
4. Run or document all gate commands.
5. Verify MVP v1 cutline.
6. Verify no fake success.
7. Verify OpenAPI generated.
8. Verify RBAC/auth/audit basics.
9. Create/update `docs/PRODUCTION_READINESS_GATE.md`.
10. Mark each gate pass/fail/partial with evidence and ship/no-ship decision.
</instructions>

<gates>
- lint
- typecheck
- test
- build
- prisma generate
- migration status
- openapi generate
- backend auth/RBAC
- admin audit
- feature flags
- entitlement/quota
- security hardening
- learning focus/effectiveness
- media accessibility/provenance
- privacy-safe sharing/competition
- learning quality gate
- assessment quality gate
- media quality gate
- growth ethics gate
- finance/gambling ethics gate
- life-in-Japan context safety
- red-team abuse review
- release director ship/no-ship
- docs/handoff
</gates>
