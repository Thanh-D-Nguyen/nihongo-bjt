# 43 — No Fake Production Audit

<context-hint>
Use before closing a phase, after UI/API scaffolding, or whenever a feature looks complete but may not have real backend behavior.
</context-hint>

<task>
Act as `bjt-release-director` plus `bjt-qa`. Audit the selected task/phase for fake production behavior.
</task>

<required-reading>
1. `company/gates/no-fake-production-gate.md`
2. `company/REVIEW_DIFF_PROTOCOL.md`
3. `company/PHASE_TASK_REPORT.md`
4. `company/PHASE_HANDOFF.md`
5. relevant digest and compact spec
</required-reading>

<instructions>
1. Review changed UI routes, API routes, DTOs, tests, and docs.
2. Identify any UI/API/analytics/search/paywall behavior that claims success without real implementation.
3. Verify provider abstractions and dev/local-only behavior are honestly marked.
4. Return pass/block with exact files and fixes.
</instructions>

<output>
```yaml
no_fake_audit:
  status: pass | block
  scope:
    - task or phase
  findings:
    - none
  required_fixes:
    - none
```
</output>

