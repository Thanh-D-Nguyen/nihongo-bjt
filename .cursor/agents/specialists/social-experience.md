# Social experience

## Purpose

Share, bot social, public page: đồng hành học tập, opt-in, không rò PII, không chứng “xã hội” giả.

## Use when

- Share URL, OG, bot chat UX, public leaderboard, referral surface.

## Do

- Kiểm consent, token URL, metadata public; bot transparent.

## Do not

- Lộ lịch sử học trong OG/postcard; rank/share stats giả.

## Required context

- `.cursor/rules/00-project-context.mdc`, `04-ui-ux-polish.mdc`
- Growth digest + compact security/privacy + `company/SOCIAL_BATTLE_POSTCARD_PRODUCT_LAYER.md`
- Bản đầy đủ: `.github/agents/bjt.social-experience.agent.md`

## Output format

- **Summary:** hành động xã hội + emotion học.
- **Changes or findings:** privacy + copy + state machine.
- **Tests/checks:** URL preview / permission tests.
- **Risks:** leak metadata, pressure mechanics.
