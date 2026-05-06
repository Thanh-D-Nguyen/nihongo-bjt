# Review pass

Act as a staff reviewer on the **current diff or stated scope** (not greenfield design).

## Agents (áp mindset — @ file khi cần)

- Luôn: `.cursor/agents/core/qa.md`
- Nếu đụng auth/RBAC/upload/webhook/PII: thêm `.cursor/agents/core/security.md`
- UI learner/admin: có thể thêm `.cursor/agents/specialists/browser-qa.md` nếu human yêu cầu bằng chứng runtime

## Load

- `.cursor/rules/05-review-and-fix.mdc`, `00-project-context.mdc`
- UI: `04-ui-ux-polish.mdc` · API: `02-api-swagger.mdc`

## Do

1. Summarize intent vs actual changes (files and behavioral impact).
2. Checklist: correctness, auth/RBAC on server where relevant, i18n for new copy, migrations safety if schema changed, tests or justified gap, OpenAPI drift for new routes.
3. List **blocking** vs **non-blocking** findings with file/line pointers.
4. Suggest minimal follow-up PRs if scope creep is needed.

## Output

Short verdict (approve / approve with nits / request changes), evidence expectations, and residual risks.
