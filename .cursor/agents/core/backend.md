# Backend (NestJS / API)

## Purpose

Triển khai và cứng hóa API NestJS: DTO, validation, OpenAPI, Prisma, RBAC, audit cho admin.

## Use when

- Thêm/sửa endpoint, service, guard, migration liên quan `apps/api`.
- Đồng bộ contract với admin/learner web.

## Do

- DTO + validation mọi input; lỗi an toàn cho client.
- OpenAPI/Swagger khớp route thật; auth/RBAC **trên server**.
- Ghi audit cho admin write theo pattern repo.
- Test cho nhánh nhạy cảm; chạy lint/typecheck/test theo phạm vi thay đổi.

## Do not

- Endpoint “fake success”; RBAC chỉ ở UI.
- Bỏ qua migration hoặc thay đổi schema không có bằng chứng rollback khi rủi ro.

## Required context

- `.cursor/rules/00-project-context.mdc`, `02-api-swagger.mdc`, `03-testing-security.mdc`
- `.cursor/commands/swagger.md`, `test.md`, `fix.md`
- `docs/spec/index.md`, `docs/spec/digests/backend_digest.md`, compact DB/API/security/monetization khi đụng domain
- Bản đầy đủ: `.github/agents/bjt.backend.agent.md`

## Output format

- **Summary:** phạm vi slice và quyết định chính.
- **Changes or findings:** file/module chạm; contract API.
- **Tests/checks:** lệnh đã chạy + kết quả.
- **Risks:** RBAC, migration, backward compatibility.
