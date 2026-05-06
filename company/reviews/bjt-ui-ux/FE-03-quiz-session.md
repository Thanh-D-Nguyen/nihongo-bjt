# FE-03 Quiz Active Session — Screen Contract

**Status**: `verified`
**Route**: Inside `/[locale]/quiz` (state-driven within `quiz-client.tsx`)
**Files**: `apps/web/app/[locale]/quiz/_components/quiz-client.tsx`

## Product Context

- **Target user**: Authenticated learner in active BJT practice
- **Primary learner outcome**: Answer BJT questions with focus
- **Primary action**: Select answer option → submit → next question
- **Secondary actions**: View progress, abandon session
- **Non-goals**: Full timed mock exam (future), reading assist blocked during timed mode

## Data Contract

- **Backend APIs**: `GET /api/quiz/sessions/:id/next`, `POST /api/quiz/sessions/:id/answer`
- **Session state**: Tracked via `SessionPayload` (correctCount, totalQuestions, status, estimatedScore)
- **Question format**: prompt, options array (optionKey + text), skillTag

## Implementation Quality

- Question display with option cards ✅
- Answer submission with server validation ✅
- Progress tracking (correct/total) ✅
- Reading assist on Japanese prompts (`AnnotatedJapaneseText`) ✅
- State transitions: question → answered → next/complete ✅

## States

| State | Implementation | Status |
|-------|---------------|--------|
| Question display | Prompt + option cards | ✅ |
| Answer selected | Visual feedback | ✅ |
| Submitting answer | Loading state | ✅ |
| Correct/incorrect feedback | Server-validated | ✅ |
| Session complete | Transition to FE-04 results | ✅ |
| Error | API failure message | ✅ |

## BJT Rules

- Reading assist: available in practice mode ✅
- Timed mode: reading assist should be blocked (future implementation)
- Score estimation: `estimatedBjtBand` from server

## Localization

- **i18n namespace**: `quiz`
- **VI/JA**: Both localized

## Acceptance

- [x] Server-validated answers
- [x] Reading assist integration
- [x] Progress tracking
- [x] State machine transitions
- [x] i18n complete
