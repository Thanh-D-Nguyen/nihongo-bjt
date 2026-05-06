# FE-10 Analytics — Screen Contract

**Status**: `verified`
**Route**: `/[locale]/analytics`
**Files**: `apps/web/app/[locale]/analytics/page.tsx`, `apps/web/app/[locale]/analytics/analytics-client.tsx` (178 lines)

## Product Context

- **Target user**: Authenticated learner tracking progress
- **Primary learner outcome**: See 7-day summary, key metrics, and weak skills
- **Primary action**: Review progress dashboard
- **Secondary actions**: Identify weak skills for remediation
- **Non-goals**: Historical comparison, export data

## Data Contract

- **Backend APIs**: Learner analytics endpoint
- **Auth**: `useKeycloakAuth()` — userId from token
- **Response**: `LearnerAnalytics` with totals (accuracy, sessions, reviews, streak), weakSkills, insight

## Implementation Quality

- Auth-gated via `useKeycloakAuth()` ✅
- 7-day summary section ✅
- Key metrics: BJT accuracy, completed sessions, review count, streak ✅
- Weak skills list with failure rate ✅
- Empty state when no data ✅
- Error state ✅
- Loading state ✅
- Real data from API rollups ✅
- Shared UI: `Card`, `CardContent`, `PageHeader`, `SectionHeader` ✅
- `generateMetadata` with localized title ✅
- Weak skills test file exists ✅

## States

| State | Implementation | Status |
|-------|---------------|--------|
| Loading | Loading indicator | ✅ |
| Data populated | Metrics + weak skills | ✅ |
| Empty (no sessions) | Empty state message | ✅ |
| Weak skills empty | "No weak skills" message | ✅ |
| Error | Error message | ✅ |

## Localization

- **i18n namespace**: `analytics`
- **VI/JA**: Both localized
- **Key fixes**: "tiến độ" not "analytics"

## Acceptance

- [x] Auth-gated
- [x] Real data (not fake charts)
- [x] Weak skills identification
- [x] Empty/error states
- [x] i18n complete
- [x] Unit test for weak skills
