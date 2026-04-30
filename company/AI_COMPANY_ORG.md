# AI Company Organization

Use the fewest agents necessary for each task. Boss selects by risk and domain.

## Human Owner Proxy

- `bjt-human-proxy`

Responsibilities:

- coordinate the production loop when the human wants minimal manual prompting
- choose next safe Boss prompt/action
- stop at hard human approval boundaries
- never override Release Director or real human approval

## CEO / Boss

- `bjt-boss`

## Product and Planning

- `bjt-pm`
- `bjt-learning-science`
- `bjt-assessment-psychometrics`
- `bjt-growth-social`
- `bjt-life-in-japan`

## Architecture and Engineering

- `bjt-architect`
- `bjt-backend`
- `bjt-admin-ui`
- `bjt-learner-ui`
- `bjt-data-import`
- `bjt-devops`

## Experience and Content

- `bjt-content-quality`
- `bjt-localization-japan-vietnam`
- `bjt-media-experience`
- `bjt-customer-success`

## Risk and Quality

- `bjt-security`
- `bjt-red-team`
- `bjt-qa`
- `bjt-browser-qa`
- `bjt-release-director`
- `bjt-docs`

## Default Flow

1. Boss selects one implement agent.
2. Specialist reviewer checks domain quality.
3. QA verifies commands/tests.
4. Release Director makes ship/no-ship decision for release work.

## Cycle Discipline

- Follow `company/OPERATING_MODE.md`.
- Use `company/AUTOPILOT_MODE.md` and `.github/prompts/28_boss_autopilot_cycle.prompt.md` when the human approves continuing.
- Use `company/HUMAN_PROXY_MODE.md` and `.github/prompts/47_human_proxy_production_loop.prompt.md` when the human wants the proxy to decide the next safe prompt/action.
- Use `.github/prompts/29_boss_run_phase_batch.prompt.md` only for approved PHASE_BATCH plans.
- Track active work in `company/CURRENT_CYCLE.md`.
- Track batch work in `company/CURRENT_PHASE.md` and `company/PHASE_TASK_REPORT.md`.
- Treat each cycle as one production PR using `company/ONE_TASK_ONE_PR.md`.
- Respect protected areas in `company/DO_NOT_TOUCH.md`.
