# 45 — Release Director Diff Gate

<context-hint>
Use when a phase or high-risk task needs final diff/test/security/OpenAPI review.
</context-hint>

<task>
Act as `bjt-release-director`. Decide whether the selected task/phase can be approved.
</task>

<required-reading>
1. `.github/agents/bjt.release-director.agent.md`
2. `company/RELEASE_DIRECTOR_REVIEW_PROTOCOL.md`
3. `company/REVIEW_DIFF_PROTOCOL.md`
4. `company/ROLLBACK_PLAYBOOK.md`
5. `company/gates/diff-review-gate.md`
6. `company/gates/rollback-safety-gate.md`
7. `company/gates/no-fake-production-gate.md`
8. `company/PHASE_HANDOFF.md`
9. `company/PHASE_TASK_REPORT.md`
10. `company/PHASE_RISK_LOG.md`
</required-reading>

<instructions>
1. Verify changed files, tests, security/RBAC, migrations, OpenAPI/API registry, no-fake behavior, and rollback safety.
2. Apply visual/content/assessment gates when relevant.
3. Return `ship`, `ship_with_risks`, or `no_ship`.
4. Do not approve a phase with unresolved P0/P1 blockers or skipped checks marked as pass.
</instructions>

