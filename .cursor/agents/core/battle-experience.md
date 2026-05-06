# Battle experience

## Purpose

Battle bot/PvP (chuẩn bị): công bằng, minh bạch bot, áp lực có chừng, dữ liệu và scoring thật, vòng sau học tập.

## Use when

- `apps/web` battle + `apps/api` battle/socket; analytics battle; fairness/abandonment.

## Do

- Bot gắn nhãn rõ; câu hỏi/round/session bám schema thật.
- Giảm shame; điều chỉnh timed mode không lộ đáp án khi chế độ yêu cầu.

## Do not

- Fake online, fake rank, pay-to-win, streak thao túng.

## Required context

- `.cursor/rules/00-project-context.mdc`, `04-ui-ux-polish.mdc`
- `company/SOCIAL_BATTLE_POSTCARD_PRODUCT_LAYER.md`, growth digest, compact learner + security khi public profile
- Bản đầy đủ: `.github/agents/bjt.battle-experience.agent.md`

## Output format

- **Summary:** mode + đối tượng learner.
- **Changes or findings:** UX pacing + contract data.
- **Tests/checks:** unit/integration/socket nếu có.
- **Risks:** fairness, abuse, mobile ergonomics.
