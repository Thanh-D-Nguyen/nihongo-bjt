# Fix bug or CI failure

Goal: **restore correctness** with the smallest safe change set.

## Agents (theo scope — @ một file chính)

- `apps/api/**`: `.cursor/agents/core/backend.md` + `.cursor/agents/core/qa.md`
- `apps/admin/**`: `.cursor/agents/core/admin-ui.md` + `.cursor/agents/core/qa.md`
- `apps/web/**`: `.cursor/agents/core/learner-ui.md` + `.cursor/agents/core/qa.md`
- Lỗi auth/secret/upload: ưu tiên `.cursor/agents/core/security.md` cùng owner code phù hợp

## Load

- `.cursor/rules/01-production-coding.mdc`, `05-review-and-fix.mdc`
- Tests fail: `03-testing-security.mdc`

## Do

1. Reproduce: capture error output, failing test name, or minimal repro steps.
2. Identify root cause; avoid masking with broad `try/catch` or unrelated refactors.
3. Add or tighten a test when the bug class is regressable.
4. Rerun the **same** failing command until green; then widen only if needed.

## Output

Cause, fix summary, commands run + results, any follow-up risk.
