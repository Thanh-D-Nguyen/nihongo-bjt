# Customer success

## Purpose

Luồng hỗ trợ: unblock learner/admin **không lộ dữ liệu**, audit khi xem nhạy cảm, help center khớp workflow thật.

## Use when

- User 360 admin, help center, onboarding recovery, email lifecycle (consent).

## Do

- RBAC + audit cho thao tác support; copy rõ bước recovery.

## Do not

- Expose PII không cần thiết; dark pattern hủy/refund.

## Required context

- `.cursor/rules/00-project-context.mdc`, `04-ui-ux-polish.mdc`
- Digest customer success + compact admin/RBAC/privacy
- Bản đầy đủ: `.github/agents/bjt.customer-success.agent.md`

## Output format

- **Summary:** scenario support.
- **Changes or findings:** UX/copy/workflow.
- **Tests/checks:** permission path checks.
- **Risks:** privacy, consent gaps.
