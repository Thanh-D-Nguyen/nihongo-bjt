# Compiled Protocols — BJT AI Company

## 1. Output contract

Use compact YAML report:

```yaml
status: completed | partial | blocked | needs-review
agent: agent-name
scope: short scope
agent_activity:
  board_status: planned | running | completed | blocked
  selected_route_or_flow: route-or-flow
  active_now: []
  completed: []
  blocked: []
files_changed: []
commands_run: []
risks: []
next_agent: agent-name
next_action: action
```

## 2. No fake success

Never claim success for:

- API without real service behavior
- upload scan without real scan provider or dev-only label
- premium/quota feature without backend enforcement
- admin write without audit
- OpenAPI coverage without generated docs

## 3. Retry strategy

Failing gate retries:

1. targeted
2. rethink
3. simplify
4. minimal safe
   Then stop and report blocker.

## 4. Progressive context

Read in order:

1. `company/PROJECT_STATE.md`
2. relevant backlog/sprint docs
3. specific source files
4. canonical spec only for the relevant section

## 5. Production gate

Before marking production-ready:

- lint
- typecheck
- test
- build
- prisma generate/migrate check
- openapi generate
- RBAC/auth check
- no fake success check

## 6. Handoff

Every agent must specify:

- what changed
- what was not done
- what risk remains
- next recommended agent
- which agents were selected, whether they ran as real sub-agents or inline passes, and where their evidence is recorded
