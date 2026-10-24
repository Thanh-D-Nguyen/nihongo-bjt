# Life in Japan Learning Design

## Purpose

Make NihonGo BJT more useful and engaging by teaching Japanese through real situations that Vietnamese learners in Japan care about.

This is a learning design layer, not a financial, legal, tax, real-estate, or gambling product.

## Design thesis

Learners stay focused when study connects to problems they actually face:
- reading a rental contract
- understanding a payslip
- asking a bank question
- reading a city office notice
- understanding risk warnings in financial news
- interpreting lottery/probability language without encouraging gambling

Each scenario must produce language progress: vocabulary, kanji, grammar, listening, reading, quiz, remediation, and confidence.

## Core modules

### Housing in Japan

Learning goals:
- understand rental and moving vocabulary
- read basic contract/notice language
- practice polite email/phone phrases

Example topics:
- 敷金, 礼金, 更新料, 保証人, 管理費
- 住宅ローン vocabulary as reading comprehension
- repair request messages

Safety:
- no legal or mortgage advice
- show disclaimer for contract/loan decisions

### Money, Banking, and Remittance

Learning goals:
- understand bank/ATM/remittance wording
- practice counter/support conversations
- read fee and transfer notices

Example topics:
- 振込, 手数料, 残高, 口座, 本人確認
- salary deposit and basic budgeting vocabulary

Safety:
- no product recommendation
- no affiliate-style ranking

### Salary, Tax, Insurance, and Pension

Learning goals:
- read payslip and public notices
- understand resident tax, health insurance, and pension vocabulary
- prepare city-office/workplace conversations

Example topics:
- 給与明細, 源泉徴収, 住民税, 年末調整, 健康保険, 年金

Safety:
- current rules need source/date
- no tax/legal advice claims

### Investment and Risk Literacy

Learning goals:
- understand financial news and risk warnings in Japanese
- learn words for price movement, volatility, fraud, and loss
- practice cautious business Japanese around uncertainty

Example topics:
- 株式, 投資信託, 暗号資産, 為替, 変動, 損失, 詐欺, リスク

Safety:
- no buy/sell/hold advice
- no fake portfolio gains
- no FOMO copy

### Lottery and Probability Literacy

Learning goals:
- understand public notices and convenience-store dialogue
- learn probability and responsible-choice vocabulary
- compare casual Japanese vs formal notices

Example topics:
- ロト6, ロト7, 抽せん, 当せん, 確率, 購入, 注意事項

Safety:
- no purchase encouragement
- no gambling reward loop
- no monetized lottery CTA

## Learner UX pattern

Each scenario should follow:

1. Learning objective.
2. Short real-life context.
3. Japanese input: text/audio/dialogue/document.
4. Reading Assist and vocabulary.
5. BJT-style comprehension question.
6. Explanation and remediation.
7. Add useful words to flashcards.
8. Optional privacy-safe share postcard about learning progress.

## Admin design pattern

Admin content should include:
- category
- risk category
- source/provenance/date
- disclaimer type
- language level
- BJT skill tags
- content quality status
- localization status
- publish/feature flag state
- audit history

## Metrics

Track:
- life-context lesson completion
- useful/confusing feedback
- vocabulary added to cards
- remediation completion
- quiz accuracy by context
- comeback rate from practical-life content
- sensitive-topic hide/mute rate

Do not track:
- wealth
- investments
- lottery participation
- real estate purchase intent
- tax/immigration status

## Release gates

Required:
- `company/gates/learning-quality-gate.md`
- `docs/spec/digests/content_quality_digest.md` through Content Quality review when content is canonical
- `company/gates/finance-gambling-ethics-gate.md`
- `company/gates/media-quality-gate.md` when media is used
- `company/gates/growth-ethics-gate.md` when sharing/referral is used

## iOS Today Life feed — operator handoff (2026-10)

- Contract: anonymous `GET /api/life/feed?city=tokyo` (10 fixed city IDs); `docs/openapi.json` documents the DTO. Invalid city returns `400`. Until at least one editorial lesson has been explicitly reviewed, rights-cleared and published for the requested city and date, the server returns `404` with `Cache-Control: no-store`. **Do not** serve a date-only response: the iOS client replaces all on-device sample lessons as soon as it receives any valid server card.
- New Prisma migration creates `daily.life_lesson`; apply with the existing schema migration process before rolling out the Go API. In the admin console use `/life-feed` to create/edit the bilingual card JSON, verify Japanese readings and content rights, record a written rights review, then publish. Editing a published lesson revokes approval. Only `published + cleared` within the inclusive validity dates is visible to learners. Source metadata must be accurate and current (especially `observedAt`, `fetchedAt` and `expiresAt`).
- Optional live forecast: set `MET_NORWAY_USER_AGENT` to an identifying application name **plus an actual operator contact** (`https://` contact page or email), e.g. `KotobaWorks/1.0 https://YOUR-DOMAIN/contact`; omit to disable. Forecast data come from [MET Norway Locationforecast 2.0](https://api.met.no/doc/TermsOfService) under CC BY 4.0, with attribution included in each lesson; responses honor upstream `Expires` and conditional revalidation. Weather is only added after the editorial feed gate is satisfied. Do not replace this with Open-Meteo's free non-commercial tier in production.
- The embedded [Cabinet Office holiday CSV](https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv) covers **2026–2027 only**. It was converted from the published Japanese encoding to UTF-8; source/modified-data credit is attached to holiday lessons. Refresh and verify the official dataset for later years. No live transit, news, currency, lottery results, or unverified scraped content is published automatically. `nearby` remains entirely on-device and never sends exact coordinates.
- Verification: Go `lifefeed` tests, PostgreSQL integration tests (`handler_life_feed_test.go`), OpenAPI route-contract check, admin frontend tests/typecheck, and an iOS fixture comparison. Before turning on public content, approve genuinely owned or commercially licensed lessons for each topic; `404` intentionally preserves mobile sample fallback until that editorial work is done.
