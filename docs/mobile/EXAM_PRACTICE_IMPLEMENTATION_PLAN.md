# Exam / Practice — Mobile Implementation Plan

> Derived from the parity audit, API contract, state machine and UX decisions.
> Only repo-proven, real endpoints are used. No fake data.

## Guiding constraints

- Exam Mode is the parity surface; Lesson Practice is a local preview aid.
- Touch only what is needed; preserve existing architecture (domain/data/
  presentation, Riverpod, `ApiClient`, `ExamDto` defensive parsing).
- Every batch ends with `flutter analyze` + `flutter test` (+ `git diff --check`).

## Batch 1 — Data/API/session foundation

- Exam stack already wired (`ExamRepository`, `ExamDto`, providers). Verify and
  add missing **tests** rather than rewriting working code:
  - `ExamRepository`: templates list, start session, current question, submit
    answer — success + error (network, invalid shape, 403) using a fake
    `ApiClient`/`http.Client`.
  - `ExamDto`: defensive parsing of session/question/currentQuestion.
- Practice repository (`LocalPreviewQuestionRepository`) already deterministic;
  add a session-controller test (select/next/previous/restart, score).
- No fake questions/scores introduced.

## Batch 2 — Practice Question Player polish

- Player already full-screen, deterministic CTA, sticky safe-area CTA, progress.
- Confirm: long JA/VI wrapping, dark mode, no bottom-nav conflict.
- Add/extend widget tests: disabled-before-answer, enabled-after, Q1 Next, mid
  Next, last Finish→summary, repeated Next no double-advance, summary reachable.

## Batch 3 — Exam Mode (complete for current scope)

- Entry (`ExamBrowserPage`) + player already real. Confirm timer, navigation,
  timeout, result transition.
- Optional (only if low-risk): wire `GET /quiz/session/active` resume. If
  deferred, document in known limitations (endpoint exists, not yet surfaced).
- Add widget tests for the pure `ExamPlayerView` (select enables submit, submit
  loading locks options) and `_Phase` transitions via a fake repository.

## Batch 4 — Result / Explanation / Review (complete)

- **Domain**: `ExamBreakdown`, `ExamBreakdownItem` in `exam_models.dart`.
- **DTO**: `ExamDto.breakdown(...)` + `breakdownItem(...)` (defensive).
- **Repository**: `ExamRepository.breakdown(sessionId)` →
  `GET /api/quiz/session/:id/results/breakdown`.
- **UI**: `ExamReviewView` (pure presentation) — header (score/band), filter
  (All/Wrong/Correct), per-question cards: prompt, chosen key, calm verdict,
  `explanationVi`, skill/section chips. Optional "save to flashcards" when
  `remediationCardId` present (`POST /api/flashcards/add-from-remediation`).
- **Wire**: add `reviewLoading`/`reviewShown` phases to `ExamPlayerPage`;
  `ExamResultView` gets a "Review answers" CTA.
- **l10n**: new `examReview*` keys in VI + JA.
- Do not fabricate the correct-option text (not in payload).
- Tests: breakdown DTO parse, repository success/error, review view rendering +
  filter, save-card action (fake repo).

## Batch 5 — Audio / image media (complete without fake playback)

- Capability check result: **no audio/TTS package** in `apps/mobile/pubspec.yaml`
  (verified). Therefore: do **not** implement fake audio.
- Parse `audioScript`, `imageUrl`, `imageAlt`, `imagePrompt`, and `testType`.
- Practice shows transcript; official simulation hides it.
- Real image renders; missing/failed image shows localized generation prompt.

## Batch 6 — Sensory & UI/UX polish

- Apply `bjt-mobile-sensory-design`: selection haptic on option tap (already on
  practice; add to exam option select), light haptic on submit, medium on
  finish; calm success/danger soft colors in review; reduced-motion respected.
- Verify small-screen (360 dp), tablet width, touch targets, dark-mode contrast,
  explanation readability.
- Add/refresh widget previews where feasible.

## Batch 7 — Integration tests

- Practice: start → answer Q1 → next → answer Q2 → finish → summary (real local
  repo, no network).
- Exam: entry → start → answer → result → review, driven by a fake
  `ExamRepository` override (no real credentials/network).

## Batch 8 — Retest docs + final verification

- `EXAM_PRACTICE_RETEST_CHECKLIST.md`, `EXAM_PRACTICE_RETEST_PROMPT_FOR_CODEX.md`,
  update `MOBILE_KNOWN_LIMITATIONS.md`, `MOBILE_MANUAL_QA_CHECKLIST.md`.
- Final: `flutter analyze`, `flutter test`, `git diff --check`,
  `flutter build apk --debug` (if toolchain available).

## 2026-07 production-score batch

- Browser explains full BJT simulation versus target practice and the standard
  three-part format.
- Result uses server `estimatedScore` (0–800) with an explicit estimated /
  non-official caveat.
- Completed breakdown is loaded as partial data for real section correct/total.
- No backend/schema/web changes are part of this mobile batch.

## File map (new / touched)

| Path | Change |
| --- | --- |
| `lib/features/exam/domain/exam_models.dart` | + `ExamBreakdown`, `ExamBreakdownItem` |
| `lib/features/exam/data/exam_dto.dart` | + `breakdown` parsing |
| `lib/features/exam/data/exam_repository.dart` | + `breakdown()` (+ optional `activeSession`, remediation) |
| `lib/features/exam/presentation/exam_review_view.dart` | NEW pure review UI |
| `lib/features/exam/presentation/exam_result_view.dart` | + Review CTA |
| `lib/features/exam/presentation/exam_player_page.dart` | + review phases |
| `lib/l10n/app_vi.arb` / `app_ja.arb` | + `examReview*` keys |
| `test/features/exam/**` | + repository/DTO/view/integration tests |
| `test/features/practice/**` | + session/player tests |
| `docs/mobile/EXAM_PRACTICE_*.md` | audit + retest docs |
