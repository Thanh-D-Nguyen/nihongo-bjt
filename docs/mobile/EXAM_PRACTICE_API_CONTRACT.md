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
                 estimatedBjtBand? }
403 → entitlement/quota denied (upgrade required)
```

### Current question

```
GET /api/quiz/session/:id/question
→ { question: ExamQuestion | null, session: ExamSession }
   ExamQuestion { id, prompt, scenario?, sectionCode?, skillTag?, difficulty?,
                  audioUrl?, imageUrl?, imageAlt?, options: ExamOption[] }
   ExamOption   { id, optionKey, text }
question == null OR session.status == "completed" → session ended (timeout/done)
```

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

### Per-question breakdown  (Batch 4 — NEW on mobile)

```
GET /api/quiz/session/:id/results/breakdown
→ {
    sessionId, testId, testTitleVi, testTitleJa,
    estimatedScore, estimatedBjtBand,
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

### Official-simulation status  (Batch 3 optional, pre-start gating)

```
GET /api/quiz/official-simulation/status
→ { enabled, entitled, featureFlag, entitlementKey, availableTemplates,
    enforcementEnabled, planSlug }
```

## Audio (Batch 5)

- Question payload may carry `audioUrl` (pre-recorded, MinIO/CDN) and
  `audioScript` (TTS fallback text). Web enforces ≤2 plays for listening
  sections (`isAudioSection(code)` → "LC"/"LR").
- Mobile model exposes `audioUrl` only. `audioScript` is **not** currently
  parsed. Real playback requires an audio capability in the mobile app — see
  `EXAM_PRACTICE_UX_DECISION.md` §Audio for the feasibility decision.

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
