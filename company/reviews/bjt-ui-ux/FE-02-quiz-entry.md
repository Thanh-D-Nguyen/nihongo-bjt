# FE-02 BJT Practice Entry — Screen Contract

**Status**: `verified`
**Route**: `/[locale]/quiz`
**Files**: `apps/web/app/[locale]/quiz/page.tsx`, `apps/web/app/[locale]/quiz/_components/quiz-client.tsx`

## Product Context

- **Target user**: Authenticated learner preparing for BJT
- **Primary learner outcome**: Select a BJT practice template and start a quiz session
- **Primary action**: Choose template → start session
- **Secondary actions**: View past results, navigate to results breakdown
- **Non-goals**: Mock exam timing (within quiz session FE-03)

## Data Contract

- **Backend APIs**: `GET /api/quiz/templates`, `POST /api/quiz/sessions`, `GET /api/quiz/sessions/:id/next`
- **Auth**: `useKeycloakAuth()` — userId resolved from token
- **Persistent models**: QuizTemplate, QuizSession
- **Fake data**: `[Seed]` prefixed templates filtered from display

## Implementation Quality

- Auth-gated via `useKeycloakAuth()` ✅
- Template list with locale-aware titles (`titleVi`/`titleJa`) ✅
- Shared UI components: `Card`, `CardContent`, `PageHeader` from `@nihongo-bjt/ui` ✅
- Reading assist integration: `AnnotatedJapaneseText` for question prompts ✅
- `generateMetadata` with localized title ✅
- Quiz state machine: template selection → session → question → results ✅

## States

| State | Implementation | Status |
|-------|---------------|--------|
| Loading templates | Fetch from API | ✅ |
| Template list | Cards with locale-aware titles | ✅ |
| Empty templates | No templates available message | ✅ |
| Error loading | Error state with message | ✅ |
| Session in progress | Transitions to FE-03 | ✅ |

## Localization

- **i18n namespace**: `quiz`
- **VI/JA**: Both localized, locale-aware template titles

## Acceptance

- [x] Auth-gated
- [x] [Seed] templates filtered
- [x] Locale-aware titles
- [x] Reading assist for Japanese text
- [x] i18n complete
