# FE-22 Terms of Service — Screen Contract

**Status**: `verified`
**Route**: `/[locale]/terms`
**Files**: `apps/web/app/[locale]/terms/page.tsx`

## Product Context

- **Target user**: Any visitor (trust/legal surface)
- **Primary learner outcome**: Understand terms of service
- **Primary action**: Read terms sections

## Implementation Quality

- Title + subtitle ✅
- 5 content sections with i18n ✅
- `generateMetadata` with localized title ✅
- Same design pattern as privacy page ✅
- Responsive padding ✅

## States

| State | Implementation | Status |
|-------|---------------|--------|
| Default | 5 terms sections | ✅ |
| Mobile 375px | max-w-2xl responsive | ✅ |

## Localization

- **i18n namespace**: `termsPage`
- **VI/JA**: Both localized

## Acceptance

- [x] No technical text
- [x] i18n complete
- [x] Linked from footer
