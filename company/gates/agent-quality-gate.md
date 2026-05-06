# Agent Quality Gate

## Purpose

Use this gate before an old or newly selected `.github/agents/bjt.*.agent.md` file is used in a production loop.

The gate keeps specialist agents production-safe, bounded, and auditable. It does not replace the product spec, UI gates, security gates, or Release Director review.

## Required Inputs

1. `.github/agents/bjt.*.agent.md` files selected for the current task
2. `company/skills/agent-quality/00-karpathy-production-agent-skill.md`
3. `company/model-routing.md`
4. `protocols/compiled-protocols.md`
5. any prompt that will invoke the selected agents

## Required Agent Structure

Every selected BJT agent must include:

- frontmatter with `name` and `description`
- `<role>`
- `<model-routing>`
- `<context-budget>`
- `<constraints>`
- `<workflow>`
- `<report-contract>` or an equivalent output/report section that explicitly names the protocol or YAML contract to use

If an old agent is missing one of these sections, patch the agent document before using it when the patch is small and does not change product behavior. If the missing section changes authority, safety, release, billing, privacy, or security behavior, mark the gate `block` and request the real human decision.

## Quality Checks

### Scope

- Agent responsibility is concrete and bounded.
- The agent cannot act as both sole implementer and final reviewer for high-risk work.
- The agent uses the fewest necessary collaborators.
- The agent has a clear stop/continue boundary.

### Production Behavior

- The agent forbids fake production readiness, fake data, and UI-only enforcement where backend persistence or provider contracts are required.
- The agent routes missing backend/API/provider support instead of inventing frontend-only state.
- The agent requires i18n, RBAC, audit logs, provenance, tests, or browser evidence when the domain requires them.

### Context Use

- The agent has a context budget that prefers compact state, relevant files, and selected gates.
- The agent reads the full canonical spec only when compact docs conflict or the task is release/security/architecture sensitive.

### Reporting

- The agent reports assumptions, changed files, commands, acceptance status, risks, and next safe action.
- The report format is machine-scannable enough for Human Proxy or Boss to continue without manual interpretation.

## Gate Result

```yaml
agent_quality_gate:
  status: pass | patched | block
  agents_checked:
    - agent:
      missing_sections:
        - none
      action: pass | patched | blocked
      notes:
  model_routing_checked: yes | no
  referenced_agents_exist: yes | no
  blocker:
    - none
```

## Pass Criteria

The gate passes when:

- all selected agents have the required structure;
- selected agents are present in `company/model-routing.md`;
- referenced BJT agents exist as `.github/agents/*.agent.md`;
- missing sections were patched safely or documented as a blocker;
- no selected agent can create fake completion or bypass hard human approval boundaries.
