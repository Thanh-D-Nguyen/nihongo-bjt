# FE-19 Onboarding — Screen Contract

**Status**: `verified`
**Route**: `/[locale]/onboarding`
**Files**: `apps/web/app/[locale]/onboarding/page.tsx`, `apps/web/app/[locale]/onboarding/_components/onboarding-client.tsx`

## Product Context

- **Target user**: Newly registered learner
- **Primary learner outcome**: Set BJT level, learning preferences, and initial study plan
- **Primary action**: Complete onboarding flow (level placement, preferences)
- **Secondary actions**: Skip onboarding
- **Non-goals**: Full placement test (future)

## Data Contract

- **Auth**: `RequireKeycloakAuth` wrapper — redirects to login if unauthenticated
- **Backend APIs**: Learner profile creation/update
- **Persistent**: Onboarding preferences saved to learner profile

## Implementation Quality

- Auth-gated: `RequireKeycloakAuth` component ✅
- Client component: `OnboardingClient` with `labels` prop ✅
- i18n: All labels passed from `t.onboarding` ✅

## States

| State | Implementation | Status |
|-------|---------------|--------|
| Unauthenticated | Redirect to login | ✅ |
| Authenticated | Onboarding flow | ✅ |

## Localization

- **i18n namespace**: `onboarding`
- **VI/JA**: Both localized
- **Key fixes applied**: "placement" → "đánh giá trình độ", "Band" → "Cấp độ"

## Acceptance

- [x] Auth-gated
- [x] No technical text
- [x] i18n complete
- [x] Level-appropriate terminology
