# Review Diff Protocol

## Goal

Make code review precise, scoped, and reproducible for Copilot phase work.

## Required Inputs

- current task or phase id
- changed files list from `company/PHASE_TASK_REPORT.md` or `company/PHASE_HANDOFF.md`
- acceptance criteria
- commands run and results
- risk log entries

## Review Steps

1. Confirm every changed file belongs to the selected task.
2. Flag unrelated churn, formatting-only noise, and accidental rewrites.
3. Check protected modules against `company/DO_NOT_TOUCH.md`.
4. Review API contract changes against `docs/API_REGISTRY.md`, `docs/BACKEND_API_REGISTRY.md`, and generated OpenAPI when present.
5. Review schema/migration changes before service/controller/UI changes.
6. Map each changed behavior to at least one test or explicit risk.
7. Verify i18n for every user-facing string.
8. Verify admin writes include RBAC and audit logging.
9. Verify fake-success risks with `company/gates/no-fake-production-gate.md`.
10. Record result as `pass`, `pass_with_risks`, or `block`.

## Generated File Rule

Generated files may change only when:

- source DTO/schema/config changed
- generation command is recorded
- generated output is committed consistently across all mirrored docs/files

## OpenAPI Diff Rule

For API changes, reviewer must check:

- route appears in registry
- DTO request/response is typed
- auth/RBAC is documented
- error behavior is represented or intentionally documented
- generated OpenAPI matches source decorators/contracts

## UI Diff Rule

For UI changes, reviewer must check:

- route is real and reachable
- loading, error, empty, success, and permission states exist
- no fake local-only production data
- copy uses i18n keys
- visual review gate is required for user-visible layout changes

## Review Output

```yaml
diff_review:
  status: pass | pass_with_risks | block
  task_id: PHXX-TYY
  files_reviewed:
    - path
  unrelated_changes:
    - none
  protected_file_impact:
    - none
  tests_mapped:
    - command: result
  blockers:
    - none
  residual_risks:
    - risk with owner
```

