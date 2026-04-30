# 29 — Boss Run Phase Batch

<context-hint>
Use when the human approves a full production phase and wants multi-task execution without per-task approval stops.
</context-hint>

<task>
Act as `bjt-boss` in PHASE_BATCH mode. Execute the approved phase queue end-to-end, stopping only at phase gates, budget limits, or serious blockers.
</task>

<instructions>
1. Read `.github/agents/bjt.boss.agent.md`.
2. Read `company/OPERATING_MODE.md`, `company/PHASE_PLAN.md`, `company/CURRENT_PHASE.md`, `company/PHASE_HANDOFF.md`, `company/PHASE_TASK_REPORT.md`, `company/PHASE_RISK_LOG.md`, and `company/DO_NOT_TOUCH.md`.
3. Verify phase-level approval:
   - `approval_status: approved`
   - `approval_token` is non-empty
   - phase scope, task queue, and max task budget are defined
4. Build execution queue from `PHASE_PLAN.md` with statuses:
   - pending, in_progress, passed, failed, blocked, skipped
5. Execute tasks in strict dependency order:
   - database/schema before backend
   - backend/API before UI
   - feature flags before gated UI
   - RBAC before admin pages
   - tests before release gate
   - docs/handoff last
6. For each task:
   - assign minimal agents
   - run owner implementation pass
   - run specialist reviewer pass as required
   - run QA/release pass as required
   - keep repo runnable before moving to next task
   - update `company/PHASE_TASK_REPORT.md`
7. Update after each task:
   - `company/CURRENT_PHASE.md`
   - `company/PHASE_HANDOFF.md`
   - `company/PHASE_RISK_LOG.md`
   - `company/backlog.md`
   - `company/project-state.md`
8. Continue automatically to the next task only while all gates pass and the phase budget is not exceeded.
9. At phase end, produce final phase report and ask only phase decisions.
</instructions>

<no-instruction-only-stop>
This prompt is the phase execution prompt. Do not answer with instructions telling the user to run this prompt or Boss Phase Batch.

Forbidden unless a hard stop exists:
- "Now run Boss Phase Batch execution"
- "Run prompt 29 next"
- "Handoff ready to Boss"

If the phase is approved and a pending task exists, execute or inline the owner pass for the next dependency-safe task.
</no-instruction-only-stop>

<stop-immediately>
Stop immediately if:

1. migration may delete or rewrite existing data
2. auth/RBAC/security/billing/privacy logic is ambiguous
3. tests fail after 2 targeted repair attempts
4. build/typecheck cannot be restored
5. required secret/provider is missing
6. protected production-ready module in `DO_NOT_TOUCH` would be touched
7. fake success would be required
8. compact spec conflict remains unresolved
9. `PHASE_PLAN` explicitly requires human approval before continuation
10. max task count, max file count, or max risk threshold is exceeded
</stop-immediately>

<phase-end-output>
Report:
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

Then ask exactly one of:
- `APPROVE_PHASE`
- `REQUEST_PHASE_FIXES`
- `REJECT_PHASE`
- `RUN_NEXT_PHASE`
- `RUN_RELEASE_GATE`
</phase-end-output>
