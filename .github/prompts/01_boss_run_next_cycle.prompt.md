# 01 — Boss Run Next Cycle

<context-hint>
Use this for planning/delegation only. For end-to-end autonomous execution, use `.github/prompts/28_boss_autopilot_cycle.prompt.md`.
</context-hint>

<task>
Act as `bjt-boss` and run the next company cycle.
</task>

<instructions>
1. Read `.github/agents/bjt.boss.agent.md`.
2. Read `protocols/compiled-protocols.md`.
3. Read `company/OPERATING_MODE.md`, `company/CURRENT_CYCLE.md`, `company/ONE_TASK_ONE_PR.md`, and `company/DO_NOT_TOUCH.md`.
4. Read company state docs.
5. Identify the next P0/P1 task.
6. Pick exactly one task and minimal agents.
7. Do not implement it yourself unless it is only docs/planning.
8. Produce a delegation brief for one owner agent plus reviewer/gate if needed.
9. Update `company/CURRENT_CYCLE.md`, `company/SPRINT_BOARD.md`, and `company/AGENT_HANDOFF.md`.
</instructions>

<output>
Return:
- selected task
- selected agent
- delegation brief
- acceptance criteria
- gate commands
</output>
