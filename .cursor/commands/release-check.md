# Release check

Gom bằng chứng trước khi coi là “sẵn sàng merge/release candidate” (không thay Release Director policy).

## Agents

- `.cursor/agents/orchestration/release-director.md` (mindset verdict)
- `.cursor/agents/core/qa.md` + `.cursor/agents/core/security.md` (bằng chứng)
- CI/health: `.cursor/agents/orchestration/devops.md` nếu đụng pipeline/env

## Load

- `.cursor/rules/05-review-and-fix.mdc`, `03-testing-security.mdc`
- `.cursor/commands/review.md`, `test.md`

## Output

Ship / no-ship / điều kiện; bảng blocker P0/P1; lệnh đã chạy; residual risk.
