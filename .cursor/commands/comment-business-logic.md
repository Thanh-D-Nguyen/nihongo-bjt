# Comment business logic

Add **short, durable comments** where the code is non-obvious or domain-heavy (BJT scoring, SRS, entitlements, battle fairness, etc.).

## Agents (chọn theo miền)

- API/domain chung: `.cursor/agents/core/backend.md`
- Quiz/scoring/đề: `.cursor/agents/specialists/assessment-psychometrics.md`
- SRS/tiến độ học: `.cursor/agents/specialists/learning-science.md`
- Battle: `.cursor/agents/core/battle-experience.md`

## Load

- `.cursor/rules/01-production-coding.mdc`, `00-project-context.mdc`

## Do

1. Prefer naming and structure over long comment blocks.
2. Comment **why** (policy, invariant, edge case), not what the syntax does.
3. Reference stable doc paths in repo when useful — avoid pasting volatile URLs.
4. Do not restate secrets, PII patterns, or license text in comments.

## Output

Files touched, examples of invariants documented, anything still unclear for a future reader.
