# No Fake Production Gate

## Purpose

Prevent UI/API/docs from claiming production behavior that does not exist.

## Blockers

- UI success state without real API/backend behavior.
- API endpoint that returns fake persistent data for a production workflow.
- Analytics chart not backed by event or rollup data.
- Search result list not backed by PostgreSQL canonical content or Meilisearch/local provider abstraction.
- Premium/paywall/RBAC enforced only in frontend.
- Admin mutation without server-side permission check.
- Route shell presented as complete without incomplete status or feature flag.
- Enabled admin route shell counted as final production-ready.
- Seed/dev data shown as production truth.
- Test that only validates mocked success for required production behavior.

## Allowed Temporary Shape

Temporary implementation is allowed only when all are true:

- provider abstraction exists
- incomplete/local/dev status is explicit
- production UI does not imply final behavior
- no private or paid feature is unlocked by frontend-only logic
- follow-up task and owner are recorded

For admin workspace final release, temporary route shells are release blockers even when they are honest. Use `company/gates/admin-100-completion-gate.md`.

## Reviewer Checklist

- Does the UI call a real contract?
- Does the API persist or read canonical data where required?
- Are empty/error/loading states honest?
- Are charts and counters backed by real data?
- Are admin and paid actions enforced server-side?
- Is every mock/local provider visibly scoped to dev/test?

## Output

```yaml
no_fake_production_gate:
  status: pass | block
  fake_success_findings:
    - none
  required_fixes:
    - none
```
