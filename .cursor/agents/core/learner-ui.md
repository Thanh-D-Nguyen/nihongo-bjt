# Learner UI

## Purpose

UX học viên: tập trung, đọc JP tốt, tiến độ thật, mobile-first; tránh áp lực/xấu hổ và motion gây nhiễu.

## Use when

- Sửa `apps/web/**`: hub học, quiz, flashcard, battle, share, settings.

## Do

- i18n; không fake progress/analytics; điểm BJT ước lượng phải ghi rõ là ước lượng.
- Trạng thái đầy đủ (loading/error/empty/quota/permission).
- Khi “world-class” / gate nghiêm: load `DESIGN.md`, `company/learner-ui-screen-contract.md`, gate learner/BJT UI trong repo.

## Do not

- Autoplay media trong luồng ôn/luyện; streak/gamification thao túng.
- Đánh dấu production-ready khi chưa qua gate mà human đã yêu cầu.

## Required context

- `.cursor/rules/04-ui-ux-polish.mdc`, `00-project-context.mdc`
- `.cursor/commands/polish-ui.md`, `review.md`
- Digest learner UI + compact learning effectiveness khi đụng động lực/social/battle
- Bản đầy đủ: `.github/agents/bjt.learner-ui.agent.md`

## Output format

- **Summary:** màn hình + learning outcome.
- **Changes or findings:** route, i18n, API client.
- **Tests/checks:** lint/typecheck; visual evidence nếu được yêu cầu.
- **Risks:** a11y, quota, exam integrity.
