# Agent Activity Trace

## Purpose

Use this trace whenever Human Proxy, Boss, or a production loop selects more than one specialist.

The goal is to make agent coordination visible. A report must show which expert was selected, why, whether the expert ran as a real sub-agent or inline pass, what status it reached, and where the evidence is recorded.

Read `company/AGENT_ACTIVITY_BOARD.md` when the human asks for visibility into which specialists are active.

## Required Rule

Do not write "consulted specialists" without a trace.

If the platform did not actually spawn a sub-agent, say so directly:

- `execution_mode: inline` means the current runner followed that agent file in the same response.
- `execution_mode: subagent` means a real sub-agent was started.
- `execution_mode: planned` means the agent is selected but has not run yet.
- `execution_mode: skipped` means the agent was considered and intentionally skipped with a reason.

## Status Values

- `planned`: selected but not started yet
- `running`: currently active
- `completed`: pass finished with evidence
- `blocked`: pass could not finish
- `blocked_pending_human_acceptance`: implementation may exist, but latest human screenshot review still rejects the result
- `skipped`: not needed after scope/risk review

## Completion Rule

Do not set `board_status: completed` when any unresolved human blocker remains.

If the human has already rejected the latest screenshot, the board must be one of:

- `running`: a new rescue/rebuild is in progress;
- `blocked`: no agent is currently working and the next action is needed;
- `blocked_pending_human_acceptance`: implementation exists, but human acceptance has not happened and the latest human feedback is negative.

`pending_human_review` is not a completion state after explicit negative human feedback.

## Required Fields

```yaml
agent_activity:
  board_status: planned | running | completed | blocked | blocked_pending_human_acceptance
  selected_route_or_flow:
  current_stage:
  last_update:
  active_now:
    - agent:
      responsibility:
      execution_mode: subagent | inline | planned | skipped
      status: planned | running | completed | blocked | skipped
      reason_selected:
      evidence:
      next_action:
  next_queue:
    - agent:
      responsibility:
      execution_mode: subagent | inline | planned
      reason_selected:
  completed:
    - agent:
      responsibility:
      execution_mode: subagent | inline
      status: completed
      output_summary:
      evidence:
  blocked:
    - agent:
      reason:
      unblock_action:
  human_blockers:
    - blocker:
      status: unresolved | resolved
      latest_feedback:
```

## Human-Readable Board

When practical, include this table before or after YAML:

| Agent                   | Role in this slice                       | Mode   | Status    | Evidence              | Next action        |
| ----------------------- | ---------------------------------------- | ------ | --------- | --------------------- | ------------------ |
| `bjt-visual-experience` | Screenshot critique and visual direction | inline | completed | `company/reviews/...` | wait for QA        |
| `bjt-learner-ui`        | Implement selected variant               | inline | planned   | `apps/web/...`        | rebuild primary UI |

## Pass Criteria

The trace passes when:

- every selected specialist appears exactly once;
- active, planned, completed, and blocked specialists are visually distinguishable;
- the owner agent is clear;
- reviewer/gate agents are distinct when risk requires it;
- `subagent` is not claimed unless a real sub-agent was used;
- inline execution names the agent file that was followed;
- evidence points to a file, command, screenshot, or concise finding;
- blocked or skipped agents have reasons.
- `board_status` is not `completed` while `human_blockers.status: unresolved` exists.

## Board File

For substantial frontend/admin slices, update `company/AGENT_ACTIVITY_BOARD.md` so the human can inspect progress without reading the full final YAML output.

## Frontend Defaults

For learner frontend work:

- owner is usually `bjt-learner-ui`;
- `bjt-visual-experience` owns visual identity, hierarchy, buttons, and screenshot critique;
- `bjt-behavioral-psychology` owns CTA perception, action anxiety, decision fatigue, habit pressure, and motivation pressure;
- `bjt-learning-science` owns focus, motivation, cognitive load, and pressure;
- `bjt-media-experience` owns motion, sound, sensory feedback, quiet mode, and provenance;
- `bjt-localization-japan-vietnam` owns Vietnamese/Japanese copy;
- `bjt-backend` owns missing API/provider/data contracts;
- `bjt-qa` or `bjt-browser-qa` owns verification evidence.
