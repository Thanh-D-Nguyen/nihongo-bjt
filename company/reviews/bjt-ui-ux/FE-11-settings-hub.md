# FE-11 Settings Hub — Screen Contract

**Status**: `verified`
**Route**: `/[locale]/settings`
**Files**: `apps/web/app/[locale]/settings/page.tsx`

## Product Context

- **Target user**: Authenticated learner managing preferences
- **Primary learner outcome**: Navigate to relevant settings sub-page
- **Primary action**: Click settings category card
- **Secondary actions**: Return to home

## Implementation Quality

- `PageHeader` with eyebrow, title, subtitle ✅
- `SectionHeader` for shortcuts section ✅
- 4 `ActionCard` links: accounts, notifications, privacy, reading assist ✅
- Grid layout: `grid-cols-1 sm:grid-cols-2` responsive ✅
- Back-to-home link ✅
- `generateMetadata` with localized title ✅
- ARIA: `aria-labelledby` on section ✅

## States

| State | Implementation | Status |
|-------|---------------|--------|
| Default | 4 settings category cards | ✅ |
| Mobile 375px | Single column grid | ✅ |
| Desktop | 2-column grid | ✅ |

## Localization

- **i18n namespace**: `settings`
- **VI/JA**: Both localized
- **Key fixes**: "trong ứng dụng" not "in-app"

## Acceptance

- [x] Shared UI components
- [x] Responsive grid
- [x] ARIA landmarks
- [x] i18n complete
- [x] Back-to-home link
