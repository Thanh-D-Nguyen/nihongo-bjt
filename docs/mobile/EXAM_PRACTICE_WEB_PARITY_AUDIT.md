# Exam Mode / Practice Flow — Web ↔ Mobile Parity Audit

> Status: Batch 0 audit. Evidence-based. No API is marked missing unless repo
> search proved its absence.

## 1. Scope & terminology

Two distinct things are called "practice" across the product. They must not be
conflated:

| Concept                                                          | Web                                                                             | Mobile (current)                                                  | Backend                                                           |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------- |
| **BJT quiz/exam** (scored, real questions, timer, bands)         | `quiz/` module, same engine for `type: official` and `type: practice` templates | `features/exam/**` → `ExamPlayerPage` (real `/api/quiz`)          | `apps/api/src/quiz/**`                                            |
| **Lesson practice** (lightweight MCQ reinforcement for a lesson) | _no dedicated web page_ — web folds practice into the quiz engine               | `features/practice/**` → `PracticePage` (local preview questions) | _no `/api/practice/*` endpoint exists_ (confirmed by repo search) |

Conclusion: mobile **Exam Mode** is the parity surface for the web quiz engine.
Mobile **Practice page** is an additional offline lesson-reinforcement aid with
**no web/backend equivalent**; it is honestly labelled as preview content and is
not a parity gap.

## 2. Web quiz engine — feature inventory

Source: `apps/web/app/[locale]/quiz/_components/quiz-client.tsx`,
`quiz-results-breakdown.tsx`, `bjt-audio-player.tsx`; backend
`apps/api/src/quiz/quiz.controller.ts` + `quiz.repository.ts`.

| Feature                                                     | Web                                                                        | Backend endpoint                              |
| ----------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------- |
| List templates (official + practice)                        | yes, filter by type/level                                                  | `GET /api/quiz/templates`                     |
| Official-simulation gating (feature flag + entitlement)     | yes; explicit loading/error/retry/ready UI, learner-safe copy, upgrade CTA | `GET /api/quiz/official-simulation/status`    |
| Start session (quota/entitlement TX)                        | yes                                                                        | `POST /api/quiz/start`                        |
| Resume in-progress session after reload                     | yes                                                                        | `GET /api/quiz/session/active`                |
| Session history (recent completed)                          | yes                                                                        | `GET /api/quiz/session/history`               |
| Current question + timing                                   | yes                                                                        | `GET /api/quiz/session/:id/question`          |
| Submit answer (no correctness leak mid-session)             | yes                                                                        | `POST /api/quiz/session/:id/answer`           |
| Server-enforced timer + auto-expire                         | yes (client advisory)                                                      | enforced in repository                        |
| Results summary (score, band)                               | yes                                                                        | `GET /api/quiz/session/:id/results`           |
| Per-question breakdown + explanation                        | yes                                                                        | `GET /api/quiz/session/:id/results/breakdown` |
| Wrong-answer remediation flashcards                         | yes                                                                        | `GET /api/quiz/session/:id/remediation`       |
| Add remediation card to deck                                | yes                                                                        | `POST /api/flashcards/add-from-remediation`   |
| Revenge mode (retry wrong answers)                          | yes                                                                        | `GET/POST /api/quiz/revenge/*`                |
| Audio / listening questions (file + TTS fallback, ≤2 plays) | yes                                                                        | `audioUrl` / `audioScript` on question        |
| Flag / confidence tagging                                   | client-only state                                                          | not persisted                                 |

## 3. Mobile current state

Source: `apps/mobile/lib/features/exam/**`, `features/practice/**`,
`app/router.dart`.

| Feature                             | Mobile status                                  | Notes                                                                                      |
| ----------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------ |
| List templates                      | ✅ `ExamBrowserPage` + `examTemplatesProvider` | `/api/quiz/templates`                                                                      |
| Start session                       | ✅ `ExamRepository.startSession`               | `/api/quiz/start`                                                                          |
| Current question + timer            | ✅ `ExamPlayerPage` + `_TimerPill`             | server `remainingSeconds`                                                                  |
| Submit answer                       | ✅ `ExamRepository.submitAnswer`               | no correctness leak                                                                        |
| Server timer auto-expire            | ✅ `_onTimeout` re-fetches                     | matches web                                                                                |
| Results summary (score, band)       | ✅ `ExamResultView`                            | server estimated 0–800 score + band + honest caveat                                        |
| Per-question breakdown              | ✅ `ExamReviewView`                            | endpoint-backed review + filters                                                           |
| Remediation / add-to-flashcard      | ✅ private deck from explained mistakes        | real flashcard repository path                                                             |
| **Session resume (active)**         | ❌ not wired                                   | endpoint exists                                                                            |
| **Session history**                 | ❌ not wired                                   | endpoint exists                                                                            |
| Audio / listening questions         | ✅ honest fallback + transcript policy         | parses `audioUrl` + `audioScript`; practice shows transcript, official simulation hides it |
| Question image / AI prompt fallback | ✅                                             | `imageUrl` renders; missing image shows localized `imagePrompt`                            |
| Official-simulation gating          | ⚠️ partial — 403 → upgrade error state         | no pre-start status check                                                                  |
| Revenge mode                        | ❌ not in scope (separate feature)             | out of this mission                                                                        |
| Lesson Practice (local)             | ✅ `PracticePage`                              | preview-only, no backend                                                                   |
| Fullscreen focus (no bottom nav)    | ✅ practice + exam player outside shell        | router confirms                                                                            |
| Reading assist suppressed in exam   | ✅ `ReadingAssistPolicy.exam()`                | furigana hidden                                                                            |
| Dark mode / long text               | ✅ existing QA tests                           | `test/qa/long_text_overflow_test.dart`                                                     |

## 4. Remaining parity gaps after the 2026-07 mobile pass

1. **Real audio playback** — no audio package exists in mobile, so the UI
   renders the server transcript where policy allows and never shows a fake
   play control.
2. **Session resume/history** — endpoints exist but are not yet wired on mobile.
3. **Post-session media in review** — the breakdown contract does not include
   `audioScript`, `imageUrl`, or `imagePrompt`.
4. **Per-section 0–800 score** — the server returns overall `estimatedScore`
   plus authoritative `sectionPerformance`, but no equated 0–800 score per
   section. Mobile shows server correct/total + weighted progress.

## 5. Explicitly out of scope / not a gap

- Lesson Practice page backend (no `/api/practice/*` exists; local preview is
  intentional and honestly labelled).
- Revenge mode (separate feature, separate mission).
- Flag/confidence tagging (web stores client-only; low value on mobile).
- Admin quiz management (not a learner-app concern).

## 6. Breakdown payload reality (drives Batch 4 UI)

`GET /api/quiz/session/:id/results/breakdown` returns (verified in
`quiz.repository.ts#breakdown`):

```jsonc
{
  "sessionId": "…",
  "testId": "…",
  "testTitleVi": "…",
  "testTitleJa": "…",
  "estimatedScore": 78,
  "estimatedBjtBand": "J2",
  "sectionPerformance": [
    {
      "key": "RC",
      "accuracy": 0.75,
      "weightedAccuracy": 0.72,
      "correctCount": 15,
      "totalQuestions": 20
    }
  ],
  "breakdown": [
    {
      "questionId": "…",
      "prompt": "…",
      "selectedOption": "A", // key the learner chose
      "isCorrect": true,
      "explanationVi": "…",
      "skillTag": "vocabulary",
      "sectionCode": "RC1",
      "remediationCardId": "…" // only present when wrong
    }
  ]
}
```

Important: the breakdown does **not** include the correct option key or option
texts. So the mobile review UI can honestly show: prompt, the chosen option key,
a correct/incorrect verdict, the explanation, and skill/section context. It must
**not** fabricate a "correct answer" string that the API does not provide.

## 7. Production simulation UX decision

- The browser distinguishes **full simulation** (`type: official`) from
  **target practice** (`type: practice`) and explains the standard BJT
  three-part format (listening, listening-reading, reading).
- The learner chooses the mode before seeing mode-specific filters. Official
  templates render only after the server status is enabled and entitled; a
  status failure offers retry without exposing feature-flag or entitlement
  identifiers.
- The web hub does not present unavailable referral actions as an alternative
  route into the official simulation.
- Result uses the API's `estimatedScore` on the 0–800 scale and explicitly says
  it is not an official BJT score.
- The result fetches completed `sectionPerformance` as partial data and renders
  server-authored correct/total + weighted progress. Breakdown failure never
  replaces the authoritative overall result.
