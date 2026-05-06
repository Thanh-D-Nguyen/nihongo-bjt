# Docs & handoff

## Purpose

Giữ tài liệu điều hướng, backlog, decision log **ngắn và đúng** cho agent/human tiếp theo.

## Use when

- Kết thúc slice/phase; cập nhật trạng thái dự án; đồng bộ spec digest với thực tế triển khai.

## Do

- Cập nhật file state/backlog đã có trong `company/` hoặc `docs/` theo convention repo.
- Link tới báo cáo chi tiết thay vì copy dài.

## Do not

- Tạo tài liệu trùng lặp khổng lồ; nói “xong” khi rủi ro chưa ghi.

## Required context

- `.cursor/rules/01-production-coding.mdc`
- `docs/spec/index.md` + digest liên quan phần đang sửa
- Bản đầy đủ: `.github/agents/bjt.docs.agent.md`

## Output format

- **Summary:** mục tiêu cập nhật doc.
- **Changes or findings:** path file đã sửa.
- **Tests/checks:** link kiểm chứng (PR, CI) nếu có.
- **Risks:** chỗ doc cũ / cần owner.
