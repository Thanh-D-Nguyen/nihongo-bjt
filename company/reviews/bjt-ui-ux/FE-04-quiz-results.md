# FE-04 Quiz Results/Coaching — Screen Contract

**Status**: `verified`
**Route**: Inside `/[locale]/quiz` (results state within `quiz-client.tsx`)
**Files**: `apps/web/app/[locale]/quiz/_components/quiz-results-breakdown.tsx`

## Product Context

- **Target user**: Learner who completed a BJT practice session
- **Primary learner outcome**: Understand performance, identify weak areas, access remediation
- **Primary action**: Review question-by-question breakdown
- **Secondary actions**: Try another template, create remediation flashcards
- **Non-goals**: Historical session comparison (analytics page)

## Data Contract

- **Backend APIs**: `GET /api/quiz/sessions/:id/breakdown`
- **Response**: `BreakdownResponse` with sessionId, testId, titles, score, band, per-question breakdown
- **Per question**: prompt, selectedOption, isCorrect, explanationVi, remediationCardId

## Implementation Quality

- Score summary with estimated BJT band ✅
- Question-by-question breakdown list ✅
- Correct/incorrect visual indicators ✅
- Explanation text per question ✅
- Remediation card link when available ✅
- Locale-aware test titles ✅

## States

| State | Implementation | Status |
|-------|---------------|--------|
| Results loading | Fetching breakdown | ✅ |
| Results display | Score + band + breakdown | ✅ |
| Error loading | Error message | ✅ |

## BJT Rules

- Score labeling: `estimatedBjtBand` and `estimatedScore` from server
- Remediation: links to flashcard creation for incorrect answers

## Localization

- **i18n namespace**: `quiz`
- **VI/JA**: Both localized

## Acceptance

- [x] Server-validated results (not client-calculated)
- [x] Remediation links
- [x] BJT band display
- [x] i18n complete
