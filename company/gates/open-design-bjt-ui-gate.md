# Open Design BJT UI Gate

## Scope

Use this gate for admin or learner UI work after the normal UI production gate. It adapts Open Design's design-system, pre-flight, self-check, and critique habits to NihonGo BJT.

## P0 Gates

All P0 items must pass before a UI slice is marked production-ready.

- Design direction is named and matches the product surface:
  - admin: operations/system design;
  - learner: learning experience design.
- Existing components, tokens, spacing, typography, and nav patterns are reused unless a new pattern is explicitly justified.
- User-facing copy uses i18n keys.
- UI is wired to real API/provider contracts or clearly blocked; no fake production data, fake metrics, fake charts, or fake success actions.
- Loading, empty, error, degraded, permission-denied, and feature-disabled states exist where relevant.
- Admin writes have backend RBAC and audit evidence.
- Direct URL, nav visibility, active state, and feature-flag behavior agree.
- Responsive layout has been considered for desktop and mobile/tablet where the app exposes the route.
- The five-dimension critique has no score below `3/5`.
- Browser or visual QA evidence is recorded, or an environment blocker is documented under the browser review policy.

## P1 Checks

P1 issues can ship only with explicit risk notes.

- Primary action is singular and visually clear.
- Secondary actions are grouped and do not compete with the primary action.
- Tables support scanning: stable columns, status badges, timestamps/freshness, and row actions.
- Numeric data uses consistent formatting and tabular alignment where possible.
- Labels are product-language, not raw technical keys.
- Empty states tell the user what is missing and what action is available.
- Error states preserve trust by showing recovery or next step.
- Color is semantic and sparse; no decorative gradient default.
- The page avoids card-heavy repetition when a table, list, timeline, or detail panel would communicate better.

## Five-Dimension Critique Template

Record this in the task handoff or review file:

```yaml
open_design_bjt_critique:
  philosophy: "score/5 - evidence"
  hierarchy: "score/5 - evidence"
  execution: "score/5 - evidence"
  functionality: "score/5 - evidence"
  specificity_restraint: "score/5 - evidence"
  weakest_issue: "short description or none"
  action_taken: "fix made, blocker recorded, or none"
```

## Stop Conditions

Stop or route back to the owner when:

- any P0 item fails;
- the page can only look complete with fake data;
- the UI hides backend/RBAC/audit gaps;
- direct URL behavior contradicts the nav or feature flag;
- a five-dimension score is below `3/5` and cannot be repaired within the slice.
