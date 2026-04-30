# NihonGo BJT — GitHub Copilot AI Company Kit

Bộ thư mục này biến GitHub Copilot trên VS Code thành một mô hình vận hành giống “công ty mini” để tiếp nhận dự án BJT đang làm dở, rà theo `nihongo_bjt_cursor_master_spec_final_completed_v2.md`, rồi hoàn thiện dần tới production.

## Cách cài vào repo

Copy toàn bộ nội dung thư mục này vào **root repository** của dự án BJT.

Cấu trúc sau khi copy:

```txt
.github/
  copilot-instructions.md
  prompts/
  agents/
protocols/
company/
templates/
scripts/
```

Đặt file spec mới nhất ở root repo:

```txt
nihongo_bjt_cursor_master_spec_final_completed_v2.md
```

Nếu tên file khác, sửa biến `CANONICAL_SPEC_PATH` trong `.github/copilot-instructions.md`.

## Luồng vận hành khuyến nghị

1. Mở VS Code tại root repo.
2. Mở GitHub Copilot Chat.
3. Chạy prompt đầu tiên:
   - `.github/prompts/00_company_bootstrap.prompt.md`
4. Sau đó chạy Boss Agent:
   - `.github/prompts/01_boss_run_next_cycle.prompt.md`
5. Boss sẽ tạo hoặc cập nhật:
   - `company/PROJECT_STATE.md`
   - `company/COMPANY_BACKLOG.md`
   - `company/SPRINT_BOARD.md`
   - `company/DECISION_LOG.md`
   - `company/AGENT_HANDOFF.md`
6. Làm theo thứ tự task Boss đưa ra.

## Triết lý

- Boss Agent điều phối.
- Specialist Agents xử lý từng mảng.
- Review Agents kiểm tra trước khi merge logic.
- Không fake success.
- Không rewrite toàn bộ.
- Không phá phần đã chạy.
- Mỗi vòng làm nhỏ, build được, test được, handoff rõ ràng.

## Agent chính

| Agent | Vai trò |
|---|---|
| `bjt.boss.agent.md` | Điều phối toàn bộ công ty AI |
| `bjt.pm.agent.md` | Product/Scope/MVP/Backlog |
| `bjt.architect.agent.md` | Kiến trúc, module boundary, database/API contract |
| `bjt.backend.agent.md` | Backend NestJS/API/Prisma/OpenAPI |
| `bjt.admin-ui.agent.md` | Admin UI/UX production |
| `bjt.learner-ui.agent.md` | Learner UI/UX |
| `bjt.data-import.agent.md` | Import/profiler/staging/Meilisearch |
| `bjt.security.agent.md` | Security/RBAC/privacy/legal hardening |
| `bjt.qa.agent.md` | Test/CI/regression |
| `bjt.devops.agent.md` | Docker/CI/CD/env/observability |
| `bjt.docs.agent.md` | Docs/handoff/spec alignment |

## Prompt quan trọng

| File | Dùng khi nào |
|---|---|
| `00_company_bootstrap.prompt.md` | Khởi tạo mô hình vận hành công ty AI |
| `01_boss_run_next_cycle.prompt.md` | Cho Boss chọn việc tiếp theo |
| `02_gap_analysis.prompt.md` | Rà repo theo spec mới |
| `03_backend_api_production.prompt.md` | Hoàn thiện API/Swagger/backend |
| `04_admin_production.prompt.md` | Hoàn thiện admin các trang còn thiếu |
| `05_database_alignment.prompt.md` | Đồng bộ Prisma/migration/schema |
| `06_test_ci_hardening.prompt.md` | Test/CI/build/typecheck |
| `07_security_privacy_hardening.prompt.md` | Security/privacy/legal |
| `08_final_release_gate.prompt.md` | Gate trước khi coi là production-ready |

## Quy tắc quan trọng nhất

Không để agent trả lời “đã xong” nếu chưa có bằng chứng:

- File đã sửa
- Command đã chạy hoặc lý do không chạy được
- Test/build/typecheck status
- Rủi ro còn lại
- Handoff cho agent tiếp theo

