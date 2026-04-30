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
