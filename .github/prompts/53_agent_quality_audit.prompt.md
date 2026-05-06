# 53 - Agent Quality Audit

<context-hint>
Use before running old agents, introducing new specialist agents, or executing frontend/social/battle/admin loops that depend on multiple existing `.github/agents/bjt.*.agent.md` files.
</context-hint>

<task>
Act as `bjt-human-proxy` plus `bjt-boss` for an agent-quality preflight. Audit the selected BJT agents, patch small structural gaps when safe, and block only when the gap affects authority, security, privacy, billing, data safety, or release approval.
</task>

<required-reading>
1. `company/gates/agent-quality-gate.md`
2. `company/skills/agent-quality/00-karpathy-production-agent-skill.md`
3. `company/model-routing.md`
4. `protocols/compiled-protocols.md`
5. `.github/agents/*.agent.md` for selected agents, or all `.github/agents/bjt.*.agent.md` when no subset is provided
6. the prompt/orchestration file that will invoke those agents
</required-reading>

<instructions>
1. Determine the selected agent set from the requested route, prompt, or orchestration document. If no subset is clear, audit all `.github/agents/bjt.*.agent.md`.
2. Check each selected agent against `company/gates/agent-quality-gate.md`.
3. Verify each selected agent has a row in `company/model-routing.md`.
4. Verify referenced `bjt-*` agents exist as `.github/agents/*.agent.md`.
5. If an agent is missing only structural sections such as `<context-budget>`, `<constraints>`, or `<report-contract>`, patch the agent document with minimal production-safe text.
6. Do not change product requirements, authority boundaries, or release rules without explicit real human approval.
7. If a gap cannot be safely patched, return `block` with the exact agent and missing decision.
8. After patching, rerun the structural audit and report the result.
</instructions>

<output>
```yaml
agent_quality_audit:
  status: pass | patched | block
  scope:
    - selected agent or all_bjt_agents
  agents_checked:
    - agent:
      missing_before:
        - none
      action: pass | patched | blocked
      missing_after:
        - none
  model_routing_checked: yes | no
  referenced_agents_exist: yes | no
  commands:
    - command:
      result:
  blocker:
    - none
```
</output>
