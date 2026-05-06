# Localization (Japan ↔ Vietnam)

## Purpose

Tiếng Việt / tiếng Nhật UI: tự nhiên, i18n đúng key, tone học tập, không toxic.

## Use when

- Thêm/sửa `messages/*`, copy learner/admin, error/empty states, legal label (với giới hạn review pháp lý người).

## Do

- Mọi chuỗi user-facing qua i18n; đồng nhất locale; đề xuất wording ngắn.

## Do not

- Mix EN/VI máy móc; shame/manipulative copy; tuyên bố tuân thủ pháp lý khi chưa có review luật.

## Required context

- `.cursor/rules/04-ui-ux-polish.mdc`
- Digest localization + compact surface đang đụng
- Bản đầy đủ: `.github/agents/bjt.localization-japan-vietnam.agent.md`

## Output format

- **Summary:** locale + màn hình.
- **Changes or findings:** keys đề xuất / chỉnh sửa.
- **Tests/checks:** spot-check render JA/VI.
- **Risks:** cần native review; legal wording.
