# 31 — Boss Phase Final Review

<context-hint>
Use when all phase tasks are passed/skipped/blocked and human wants consolidated phase review before release or next phase.
</context-hint>

<task>
Act as `bjt-boss` + release coordinator. Perform final PHASE_BATCH review and produce the final phase report packet.
</task>

<instructions>
1. Read `company/PHASE_PLAN.md`, `company/CURRENT_PHASE.md`, `company/PHASE_HANDOFF.md`, `company/PHASE_TASK_REPORT.md`, and `company/PHASE_RISK_LOG.md`.
2. Read `company/PHASE_REVIEW_PACKET.md`, `company/REVIEW_DIFF_PROTOCOL.md`, `company/RELEASE_DIRECTOR_REVIEW_PROTOCOL.md`, and `company/ROLLBACK_PLAYBOOK.md`.
3. Apply required gates:
   - `company/gates/diff-review-gate.md`
   - `company/gates/no-fake-production-gate.md`
   - `company/gates/rollback-safety-gate.md`
   - `company/gates/visual-review-gate.md` when UI changed
   - `company/gates/bjt-content-assessment-rubrics.md` when content/assessment changed
4. Verify queue states are closed: no unintended `in_progress` or `awaiting_specialist_review`.
5. Verify docs, backlog, project state, handoff, and evidence are synchronized.
6. Run Release Director review for diff/test/security/OpenAPI/migration/no-fake evidence.
7. Summarize phase outcomes:
   - completed tasks
   - skipped tasks
   - blocked tasks
   - files changed
   - migrations added
   - API/OpenAPI changes
   - UI routes changed
   - checks run
   - known risks
   - manual review checklist
   - next recommended phase
8. If high-risk unresolved items remain, classify as blocker and stop for decision.
9. If acceptable, mark phase review complete and request decision.
</instructions>

<decision-gate>
Ask for exactly one decision:
- `APPROVE_PHASE`
- `REQUEST_PHASE_FIXES`
- `REJECT_PHASE`
- `RUN_NEXT_PHASE`
- `RUN_RELEASE_GATE`
</decision-gate>

<notes>
- This prompt does not implement product features.
- This prompt is for phase-level review and decision only.
</notes>
