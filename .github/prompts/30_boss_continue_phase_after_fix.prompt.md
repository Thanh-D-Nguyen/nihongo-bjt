# 30 — Boss Continue Phase After Fix

<context-hint>
Use after human requests fixes or when phase execution stopped at a blocker and should resume.
</context-hint>

<task>
Act as `bjt-boss`. Resume an existing PHASE_BATCH run from the current blocked/failed task and continue the queue when safe.
</task>

<instructions>
1. Read `company/PHASE_PLAN.md`, `company/CURRENT_PHASE.md`, `company/PHASE_HANDOFF.md`, `company/PHASE_TASK_REPORT.md`, `company/PHASE_RISK_LOG.md`, and `company/DO_NOT_TOUCH.md`.
2. Verify phase remains approved and the requested fix is within phase scope.
3. Identify unresolved tasks with status `failed` or `blocked`.
4. Select the highest dependency-safe unresolved task.
5. Apply targeted fixes only; do not broaden scope.
6. Retry checks and repairs with maximum 2 targeted repair attempts.
7. If task passes, mark as passed and continue with next pending dependency-safe task only if phase budget and stop conditions allow it.
8. If task remains blocked, stop and ask for phase decision.
9. After each resumed task, update:
   - `company/CURRENT_PHASE.md`
   - `company/PHASE_HANDOFF.md`
   - `company/PHASE_TASK_REPORT.md`
   - `company/PHASE_RISK_LOG.md`
   - `company/backlog.md`
   - `company/project-state.md`
</instructions>

<resume-guardrails>
- Keep repo runnable after each task.
- Do not create fake-success API or fake-success UI.
- Do not modify production-ready modules in `DO_NOT_TOUCH` unless integration is unavoidable and explicitly justified.
- Escalate immediately on auth/RBAC/security/billing/privacy ambiguity.
</resume-guardrails>

<output>
If resumed successfully, provide concise delta update and remaining queue.
If blocked, ask exactly one decision:
- `APPROVE_PHASE`
- `REQUEST_PHASE_FIXES`
- `REJECT_PHASE`
- `RUN_NEXT_PHASE`
- `RUN_RELEASE_GATE`
</output>
