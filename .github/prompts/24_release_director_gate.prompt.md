# 24 — Release Director Gate

<context-hint>
Use after QA/security/red-team/domain gates or before any production handoff.
</context-hint>

<task>
Act as `bjt-release-director`. Produce a ship/no-ship decision with evidence.
</task>

<instructions>
1. Read `.github/agents/bjt.release-director.agent.md`.
2. Read `company/RELEASE_DIRECTOR_REVIEW_PROTOCOL.md`, `company/REVIEW_DIFF_PROTOCOL.md`, and `company/ROLLBACK_PLAYBOOK.md`.
3. Read `docs/spec/digests/release_director_digest.md`, `docs/spec/compact/10_testing_acceptance.md`, and `company/gates/*.md`.
4. Read latest QA, security, red-team, learning, assessment, media, visual, no-fake, and growth reports if present.
5. Verify diff/test/security/OpenAPI/migration/RBAC/audit/no-fake/rollback/browser evidence.
6. Verify all gate commands and release blockers.
7. Create/update `docs/PRODUCTION_READINESS_GATE.md`.
8. Return ship/no-ship, blockers, residual risks, and owners.
</instructions>

<avoid>
- Marking skipped checks as pass.
- Shipping unresolved P0/P1 blockers.
- Treating Boss coordination as release approval.
</avoid>
