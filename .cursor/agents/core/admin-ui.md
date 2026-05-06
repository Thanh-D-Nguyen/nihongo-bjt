# Admin UI

## Purpose

Màn admin vận hành thật: shell, bảng, form, workflow, RBAC-aware, i18n — không CRUD demo.

## Use when

- Sửa `apps/admin/**`: route quản trị, bảng, filter, drawer, audit reason UI.

## Do

- i18n mọi nhãn mới; trạng thái loading/error/empty/permission/feature-off.
- Tái dùng token/component hiện có; hierarchy rõ, một primary action chính.
- Bám gate/skill nội bộ (`company/gates/admin-page-production-gate.md`, open-design BJT) khi human yêu cầu “production-ready”.

## Do not

- Dữ liệu giả/metrics giả; scaffold không gắn API thật mà gọi là xong.
- Chỉ read-only table khi domain cần thao tác vận hành (trừ khi có exception đã ghi nhận).

## Required context

- `.cursor/rules/04-ui-ux-polish.mdc`, `00-project-context.mdc`
- `.cursor/commands/polish-ui.md`, `review.md`
- `docs/spec/digests/admin_ui_digest.md`, compact admin RBAC/UI
- Bản đầy đủ: `.github/agents/bjt.admin-ui.agent.md`

## Output format

- **Summary:** route/feature và acceptance ngắn.
- **Changes or findings:** component, i18n keys, RBAC UX.
- **Tests/checks:** typecheck/lint/UI test nếu có.
- **Risks:** quyền, audit, regression nav.
