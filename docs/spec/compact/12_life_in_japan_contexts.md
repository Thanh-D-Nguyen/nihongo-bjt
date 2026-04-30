# Compact Spec 12: Life in Japan Learning Contexts

## Canonical references

Full spec sections: 13, 21.5, 21.10, 21.11, 25, 27, 31, plus compact specs 06, 07, 08, 11.

## Product principle

Use real concerns of people living in Japan as learning contexts for Japanese and BJT readiness. The product teaches language, comprehension, and risk literacy. It must not become financial advice, gambling promotion, real-estate brokerage, investment recommendation, or legal/tax advisory.

## Context domains

Supported learning domains:
- housing: renting, buying, moving, guarantor, deposits, renewal fees, loan vocabulary
- money and banking: bank account, remittance, ATM, fees, salary deposit, budgeting language
- salary, tax, insurance, pension: payslip, withholding, resident tax, health insurance, nenkin, year-end adjustment vocabulary
- workplace documents: contracts, rules, notices, HR email, business forms
- city office and public life: ward office, forms, certificates, notices, disaster alerts
- consumer safety: contracts, cancellation, scams, cooling-off, support contact language
- investment risk literacy: stocks, funds, FX, crypto, volatility, loss, fraud warnings
- lottery/probability literacy: Loto 6/Loto 7 vocabulary, probability, responsible framing, convenience-store dialogue
- career and relocation: job change, visa-related vocabulary, moving procedures, school/family forms

## Learning outputs

Each context can generate:
- BJT-style reading item
- listening or listening-reading dialogue
- vocabulary/kanji deck
- grammar-in-context note
- reading assist annotations
- flashcards with scenario examples
- quick quiz and remediation
- safe share postcard about learning achievement
- admin content quality review task

## Safety boundaries

Must not:
- recommend buying lottery tickets
- recommend stocks, crypto, funds, FX, or financial products
- predict prices, odds, or investment outcomes
- rank brokers, exchanges, lenders, realtors, or insurers as advice
- provide legal, tax, immigration, or real-estate advice as authoritative
- use affiliate/ads in a way that interrupts learning or creates dark patterns
- present generated/current facts as verified without source/provenance

Must:
- frame high-risk domains as language/risk-literacy learning
- include disclaimers for finance, lottery, housing, tax, legal, immigration, and insurance contexts
- store source/provenance/date for external/current content
- respect privacy and consent for any personalized scenario
- use i18n keys for user-facing text
- keep remediation focused on language skills and comprehension

## Topic-specific guardrails

Housing:
- teach vocabulary and document reading
- explain that contract/legal decisions require qualified professionals
- do not present mortgage or rent affordability as advice without provider abstraction and disclaimer

Lottery:
- teach vocabulary, probability language, public notices, and responsible framing
- do not gamify ticket purchase or simulate gambling reward loops
- do not monetize via lottery encouragement

Stocks/crypto/FX:
- teach chart/news vocabulary, risk warnings, and comprehension
- do not provide buy/sell/hold recommendations
- do not show fake portfolio gains
- do not create urgency or fear-of-missing-out copy

Tax/insurance/pension:
- teach forms, notices, and basic vocabulary
- require date/source provenance for current rules
- do not claim professional tax/legal advice

## Admin requirements

Admin must be able to manage:
- context category
- source/provenance/date
- risk disclaimer type
- content quality status
- level/skill tags
- remediation links
- media/license metadata
- publish/feature flag status

High-risk context publishing should require content quality review and audit log.

## UX requirements

- Place life-context content inside learning flows, not as clickbait news feed.
- Show learning objective before sensitive/high-risk topics.
- Keep the primary CTA as study/review/quiz, not financial action.
- Provide "learn the words in this document" and "practice this conversation" flows.
- Do not overload the home page with financial/lottery topics.
- Let learners mute/hide sensitive topics.

## Data and analytics

Track learning outcomes:
- context item viewed
- vocabulary learned
- quiz completed
- remediation completed
- reading assist used
- content marked useful/confusing

Do not track or infer:
- personal wealth
- investment holdings
- gambling behavior
- real estate buying intent
- sensitive immigration/tax status

## Related gates

- `company/gates/learning-quality-gate.md`
- `company/gates/media-quality-gate.md`
- `company/gates/growth-ethics-gate.md`
- `company/gates/finance-gambling-ethics-gate.md`
