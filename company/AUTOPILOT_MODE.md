# Boss Autopilot Mode

## Goal

Let Boss run production cycles end-to-end while the human acts as approval gate.

The human should be able to say:
- `approve, tiếp đi`
- `boss tiếp tục`
- `run next cycle`
- `pause`
- `stop`

## Autopilot contract

When autopilot is active, Boss must not stop at a delegation brief.

Boss must run one complete cycle:

1. Read operating state.
2. Select exactly one backlog task.
3. Update `company/CURRENT_CYCLE.md`.
4. Select minimal agents.
5. Execute owner/implement agent.
6. Execute specialist reviewer when needed.
7. Execute QA/release reviewer when needed.
8. Run or document gate commands.
9. Update backlog, project state, sprint board, decision log, and handoff.
10. Stop at human approval checkpoint.

## Human approval checkpoint

At the end of every cycle, Boss reports:
- task completed
- files changed
- commands run
- risks
- recommended next task
- approval options

Approval options:
- `approve, tiếp đi`: start next cycle
- `needs changes`: fix current cycle only
- `pause`: stop without selecting next task
- `stop`: disable autopilot

## Agent policy

Use the fewest agents necessary.

Default:
- owner implement agent
- specialist reviewer if domain risk exists
- QA/release reviewer if code, API, security, DB, or release evidence changed

Do not exceed:
- 3 agents for normal production work
- 4 agents for backend+frontend or DB/API/admin changes
- 5 agents for release/security/billing/migration/assessment gates

## Execution rule

If the environment supports subagents, Boss may dispatch them.

If the environment does not support subagents, Boss must still execute the cycle inline by assuming the selected agent role sequence:

1. owner agent pass
2. reviewer pass
3. QA/release pass

Do not return only `next_agent` / `next_action` unless blocked.

## Stop conditions

Always stop for human approval after one completed cycle when:
- files changed
- migration changed
- tests changed
- API contract changed
- security/RBAC changed
- billing/quota changed
- release gate changed

Do not silently start the next cycle without human approval.

## State files

Read and update:
- `company/AUTOPILOT_STATE.md`
- `company/CURRENT_CYCLE.md`
- `company/AGENT_HANDOFF.md`
- `company/handoff.md` if lowercase aliases are being used
- `company/COMPANY_BACKLOG.md`
- `company/backlog.md` if lowercase aliases are being used
- `company/PROJECT_STATE.md`
- `company/project-state.md` if lowercase aliases are being used

If uppercase and lowercase state files diverge, read both and use the one with the latest completed cycle as the current operational truth, then update both when feasible.
