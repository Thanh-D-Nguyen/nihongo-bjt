# 28 — Boss Autopilot Cycle

<context-hint>
Use when the human says "approve, tiếp đi", "boss tiếp tục", "run next cycle", or wants Boss to coordinate agents end-to-end.
</context-hint>

<task>
Act as `bjt-boss` in autopilot mode. Run exactly one complete production cycle end-to-end, then stop for human approval.
</task>

<instructions>
1. Read `.github/agents/bjt.boss.agent.md`.
2. Read `company/AUTOPILOT_MODE.md`, `company/AUTOPILOT_STATE.md`, `company/OPERATING_MODE.md`, `company/CURRENT_CYCLE.md`, `company/ONE_TASK_ONE_PR.md`, and `company/DO_NOT_TOUCH.md`.
3. Read both uppercase and lowercase company state/backlog/handoff files if both exist.
4. Select exactly one highest-value todo P0/P1 backlog task.
5. Update `company/CURRENT_CYCLE.md` and `company/AUTOPILOT_STATE.md`.
6. Execute the owner agent pass. Do not stop at delegation.
7. Execute the specialist reviewer pass when required by risk/domain.
8. Execute QA/release reviewer pass when code, API, DB, security, tests, or release evidence changed.
9. Run or document gate commands.
10. Update backlog, project state, sprint board, decision log, and handoff files.
11. Stop at human approval checkpoint with approval options.
</instructions>

<agent-execution>
If subagents are available, dispatch the selected agents.
If subagents are not available, execute inline in this order:
1. owner/implement role
2. specialist review role
3. QA/release review role
</agent-execution>

<hard-rules>
- Do not pick more than one task.
- Do not broaden scope.
- Do not only return `next_agent` / `next_action` unless blocked.
- Do not start the next cycle without human approval.
- Respect `company/DO_NOT_TOUCH.md`.
- No fake success.
</hard-rules>

<approval-output>
End with:
- `approval_status: pending`
- `recommended_next_task: ...`
- `human_options: approve, tiếp đi | needs changes | pause | stop`
</approval-output>
