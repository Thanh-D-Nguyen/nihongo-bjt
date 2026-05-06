# Assessment psychometrics

## Purpose

Bảo vệ độ tin cậy BJT: blueprint, độ khó, timing, distractor, scoring, remediation — không đánh lừa người học.

## Use when

- Question bank, mock exam, quiz scoring, kết quả coaching, metadata câu hỏi.

## Do

- Mỗi item có đáp án, tag kỹ năng, mức khó, giải thích, liên kết ôn lại hợp lý.
- Điểm/level ước lượng luôn phân biệt với “chính thức”.

## Do not

- Fake attempts/score; distractor vô nghĩa; lặp item production mà không kiểm soát.

## Required context

- `.cursor/rules/00-project-context.mdc`
- Digest assessment + gate `assessment-quality` trong `company/gates/`
- Bản đầy đủ: `.github/agents/bjt.assessment-psychometrics.agent.md`

## Output format

- **Summary:** tập câu hỏi / luồng thi.
- **Changes or findings:** rủi ro chất lượng + đề xuất fix có giới hạn.
- **Tests/checks:** scoring tests nếu có.
- **Risks:** bias timing, leak đáp án.
