# FE-24 Error/Not-Found/Global-Error States — Screen Contract

**Status**: `needs_i18n_fix`
**Route**: N/A (cross-cutting error recovery)
**Files**: `apps/web/app/[locale]/error.tsx`, `apps/web/app/not-found.tsx`, `apps/web/app/global-error.tsx`, `apps/web/app/[locale]/loading.tsx`

## Product Context

- **Target user**: Any visitor who hits an error
- **Primary learner outcome**: Understand something went wrong and recover
- **Primary action**: Retry or go home
- **Non-goals**: Detailed error reporting

## Implementation Quality

- **error.tsx**: Locale-level error boundary with retry button ✅
- **not-found.tsx**: 404 page with home link ✅
- **global-error.tsx**: Root error boundary with inline styles (no Tailwind available) ✅
- **loading.tsx**: Spinner with border animation ✅
- Design language match: `bg-ink` button, `text-muted` description ✅
- Recovery paths: retry button (error) or home link (404) ✅

## Known Issue

- **Hardcoded Vietnamese text**: error.tsx and not-found.tsx use hardcoded Vietnamese strings instead of i18n keys
- **global-error.tsx**: Hardcoded is acceptable (no providers available at this level)
- **Impact**: Japanese locale users see Vietnamese error messages

## States

| State | Implementation | Status |
|-------|---------------|--------|
| Runtime error | error.tsx with retry | ✅ |
| 404 Not Found | not-found.tsx with home link | ✅ |
| Root crash | global-error.tsx with inline styles | ✅ |
| Loading | Spinner animation | ✅ |
| Japanese locale errors | Hardcoded Vietnamese | ⚠️ needs fix |

## Localization

- **Current**: Hardcoded Vietnamese in error.tsx and not-found.tsx
- **Required**: Use locale from route params for error.tsx; not-found.tsx is harder (no params available)
- **global-error.tsx**: Hardcoded is acceptable (fallback of last resort)

## Acceptance

- [x] Error recovery paths exist
- [x] Design language consistent
- [x] Loading state present
- [ ] i18n for error.tsx (hardcoded Vietnamese)
- [ ] i18n for not-found.tsx (hardcoded Vietnamese — may need client detection)
