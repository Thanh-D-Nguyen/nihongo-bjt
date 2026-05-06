# FE-20 Help — Screen Contract

**Status**: `verified`
**Route**: `/[locale]/help`
**Files**: `apps/web/app/[locale]/help/page.tsx`

## Product Context

- **Target user**: Any learner needing assistance
- **Primary learner outcome**: Find answers to common questions
- **Primary action**: Browse FAQ items
- **Secondary actions**: Navigate to feedback form
- **Non-goals**: Live chat, ticket system (future)

## Implementation Quality

- Title + subtitle ✅
- FAQ section: 4 expandable `<details>` items with i18n ✅
- Contact section: card with link to feedback page ✅
- `generateMetadata` with localized title ✅
- Design tokens: `rounded-xl border-ink/10 bg-white` for FAQ, `bg-surface` for contact card ✅
- CTA: `bg-leaf` button linking to feedback ✅
- Responsive: `max-w-2xl`, `px-4 py-10` ✅

## States

| State | Implementation | Status |
|-------|---------------|--------|
| Default | FAQ list + contact card | ✅ |
| FAQ expanded | `<details>` open state | ✅ |
| Mobile 375px | max-w-2xl responsive | ✅ |

## Localization

- **i18n namespace**: `helpPage`
- **VI/JA**: Both localized
- **Copy keys**: title, subtitle, faqTitle, faq1q-faq4q, faq1a-faq4a, contactTitle, contactDesc, contactLink, metaTitle

## Acceptance

- [x] No technical text
- [x] FAQ expandable
- [x] Contact link works
- [x] i18n complete
- [x] Design system tokens
