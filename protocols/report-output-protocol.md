# Report Output Protocol

Every agent must end with this compact report:

```yaml
status: completed | partial | blocked | needs-review
agent: agent-name
scope: concise task scope
files_read:
  - path
files_changed:
  - path
commands_run:
  - command: "..."
    result: passed | failed | not-run
    note: optional
production_checks:
  auth_rbac: pass | fail | n/a
  validation: pass | fail | n/a
  openapi: pass | fail | n/a
  tests: pass | fail | n/a
  no_fake_success: pass | fail
risks:
  - none | risk text
handoff:
  next_agent: agent-name
  next_action: concrete next step
```
