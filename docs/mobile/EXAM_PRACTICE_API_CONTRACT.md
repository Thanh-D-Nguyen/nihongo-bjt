# Exam / Practice — Mobile API Contract

> Verified against `apps/api/src/quiz/quiz.controller.ts`,
> `apps/api/src/quiz/quiz.repository.ts`, and the existing mobile client
> `apps/mobile/lib/features/exam/data/exam_repository.dart`.
> All endpoints are auth-aware: the shared `ApiClient` attaches the Keycloak
> bearer token and the server resolves the learner id from it. `userId` query
> params are optional for the mobile client (token-resolved server-side).

## Base

- Base URL: `AppEnvironment.apiBaseUrl` (dev `http://localhost:4000`).
- Client: `apps/mobile/lib/core/api/api_client.dart` (`http` package).
- Errors normalize to `RepositoryException` via `guardApiCall` /
  `ExamDto`. `403` → upgrade/entitlement required.

## Endpoints used / to use by mobile

### Templates

```
GET /api/quiz/templates           (public)
→ ExamTemplate[]   { id, slug, titleVi, titleJa?, type, level?, description?,
                     timeLimitSeconds?, _count: { sections, sessions } }
```

### Start session

```
POST /api/quiz/start   body: { testId }
→ ExamSession  { id, status, currentQuestionNo, totalQuestions, correctCount,
                 remainingSeconds?, timeLimitSeconds?, estimatedScore?,
                 estimatedBjtBand?, testType? }
403 → entitlement/quota denied (upgrade required)
```

### Current question

```
GET /api/quiz/session/:id/question
→ { question: ExamQuestion | null, session: ExamSession }
   ExamQuestion { id, prompt, scenario?, sectionCode?, skillTag?, difficulty?,
                  audioUrl?, audioScript?, imageUrl?, imageAlt?, imagePrompt?,
                  options: ExamOption[] }
   ExamOption   { id, optionKey, text }
question == null OR session.status == "completed" → session ended (timeout/done)
```

`session.testType == "official"` activates exam-integrity policy on mobile:
audio transcripts and reading help remain hidden during the live session.

### Submit answer

```
POST /api/quiz/session/:id/answer   body: { questionId, optionKey }
→ { answer, session: ExamSession, remediationCardId? }
Mobile reads only `session` (correctness never leaked mid-session).
```

### Results summary

```
GET /api/quiz/session/:id/results
→ completed QuizSession (score, band, answers). Mobile currently derives the
  summary from the live ExamSession; this endpoint is the authoritative source
  if a session is reopened.
```

`estimatedScore` is computed server-side by `scoreBjtMockExam`
(`bjt-estimate-v2`) on the **0–800** scale using section balance and explicit
difficulty weighting. It is an estimate, never an official BJT result. Mobile
does not recalculate or replace this value.

### Per-question breakdown  (Batch 4 — NEW on mobile)

```
GET /api/quiz/session/:id/results/breakdown
→ {
    sessionId, testId, testTitleVi, testTitleJa,
    estimatedScore, estimatedBjtBand,
    sectionPerformance: [
      { key, accuracy, weightedAccuracy, answeredCount,
        correctCount, totalQuestions }
    ],
    breakdown: [
      { questionId, prompt, selectedOption, isCorrect,
        explanationVi, skillTag, sectionCode, remediationCardId? }
    ]
  }
```

Notes:
- Only available for a **completed** session (`404` otherwise).
- Does **not** include correct-option key or option texts. UI shows: prompt,
  chosen key, verdict, explanation, skill/section chips, remediation link.
- `sectionPerformance` is server-authored by the same scoring algorithm. Mobile
  uses its real correct/total and weighted progress.
- Does **not** include media fields or per-section 0–800 scores. Mobile does not
  invent a 0–800 score for each section.

### Remediation flashcards  (Batch 4 optional)

```
GET /api/quiz/session/:id/remediation
→ QuizSessionRemediationItem[]
   { questionId, remediationCardId, card: { id, frontText, backText, reading,
     sourceType, sourceId } }
```

```
POST /api/flashcards/add-from-remediation   body: { remediationCardId / cardId }
→ adds the card to the learner deck
```

### Session resume / history  (Batch 3 optional)

```
GET /api/quiz/session/active     → { session: ExamSession | null }
GET /api/quiz/session/history?limit=20
→ SessionHistoryItem[] { id, completedAt, totalQuestions, correctCount,
   estimatedScore, estimatedBjtBand, testTitleVi, testTitleJa, testType,
   testLevel }
```

### Official-simulation status (implemented pre-start gating)

```
GET /api/quiz/official-simulation/status
→ { enabled, entitled, featureFlag, entitlementKey, availableTemplates,
    enforcementEnabled, planSlug }
```

Mobile resolves this endpoint before enabling an official template card. A
disabled feature, missing entitlement, or unresolved status keeps the card
non-tappable; `POST /start` remains the final server-authoritative guard.

## Audio (Batch 5)

- Question payload may carry `audioUrl` (pre-recorded, MinIO/CDN) and
  `audioScript` (TTS fallback text). Mobile parses both.
- No mobile audio engine exists. The UI shows an honest playback-unavailable
  state and renders `audioScript` in practice. Official simulation hides the
  script to preserve exam integrity.

## Image media

- `imageUrl` + `imageAlt` render the real question image with accessible text.
- If `imageUrl` is missing (or fails) and `imagePrompt` exists, mobile displays
  the localized generation prompt/description as an honest fallback.
- The client never generates or stores an image and never fabricates a URL.

## Practice (local, no backend)

- `QuestionRepository.fetchQuestions(lessonId)` →
  `LocalPreviewQuestionRepository` (in-memory, `isPreview: true`).
- No `/api/practice/*` endpoint exists in the repo. Practice attempts are not
  persisted; the summary is computed client-side and honestly labelled preview.

## DTO mapping reference

- Exam: `apps/mobile/lib/features/exam/data/exam_dto.dart` — defensive manual
  mapping (no codegen), throws `RepositoryErrorKind.invalidResponse` on wrong
  shape. New breakdown DTO follows the same pattern.
- Practice: hand-written `Question` / `QuestionOption` domain objects.
