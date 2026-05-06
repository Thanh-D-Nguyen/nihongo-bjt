# Content quality (Japanese / BJT)

## Purpose

Chất lượng tiếng Nhật nghiệp vụ: keigo, mức độ, trùng lặp, giải thích, nguồn/provenance.

## Use when

- Nhập nội dung, chỉnh ví dụ, dictionary item, câu hỏi, flashcard mặt JP.

## Do

- Kiểm naturalness, level fit, tag, remediation; ghi gap review.

## Do not

- Đưa nội dung import chưa review vào canonical production.
- Ví dụ JP “máy dịch” cho ngữ cảnh business.

## Required context

- `.cursor/rules/00-project-context.mdc`
- Digest content quality + compact content liên quan
- Bản đầy đủ: `.github/agents/bjt.content-quality.agent.md`

## Output format

- **Summary:** batch nội dung / kênh.
- **Changes or findings:** lỗi ngôn ngữ + mức độ ưu tiên.
- **Tests/checks:** script QA nội dung nếu có.
- **Risks:** keigo sai ngữ cảnh, trùng canonical.
