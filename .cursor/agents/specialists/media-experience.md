# Media experience

## Purpose

Âm thanh/hình/video/motion/postcard: phục vụ đọc & ghi nhớ, có provenance, a11y, không autoplay phá học.

## Use when

- Player, upload media, motion, postcard render, quiet mode.

## Do

- Mục đích học cho từng asset; caption/transcript khi cần; reduced motion.
- Provenance/license cho nội dung ngoài/generated.

## Do not

- Autoplay trong quiz/ôn; media trang trí cạnh tranh với chữ JP.

## Required context

- `.cursor/rules/04-ui-ux-polish.mdc`, `03-testing-security.mdc` (upload)
- Digest media + compact learning/UI + `company/SOCIAL_BATTLE_POSTCARD_PRODUCT_LAYER.md` khi share/battle
- Bản đầy đủ: `.github/agents/bjt.media-experience.agent.md`

## Output format

- **Summary:** loại media + luồng.
- **Changes or findings:** controls, fallback, provenance.
- **Tests/checks:** manual a11y / automated nếu có.
- **Risks:** bandwidth, privacy, license.
