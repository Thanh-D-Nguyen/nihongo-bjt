# FE-21 Privacy Policy — Screen Contract

**Status**: `verified`
**Route**: `/[locale]/privacy`
**Files**: `apps/web/app/[locale]/privacy/page.tsx`

## Product Context

- **Target user**: Any visitor (trust/legal surface)
- **Primary learner outcome**: Understand data handling practices
- **Primary action**: Read privacy policy sections
- **Non-goals**: Cookie consent management (future)

## Implementation Quality

- Title + subtitle ✅
- 5 content sections with i18n ✅
- `generateMetadata` with localized title ✅
- Design tokens: `max-w-2xl`, section headings + body text ✅
- Responsive padding ✅

## States

| State | Implementation | Status |
|-------|---------------|--------|
| Default | 5 privacy sections | ✅ |
| Mobile 375px | max-w-2xl responsive | ✅ |

## Localization

- **i18n namespace**: `privacyPolicyPage`
- **VI/JA**: Both localized
- **Copy keys**: title, subtitle, metaTitle, section1-5 Title/Body

## Acceptance

- [x] No technical text (no PostgreSQL/database references)
- [x] i18n complete
- [x] Linked from footer
