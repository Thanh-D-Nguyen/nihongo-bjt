# BJT Exam Mode / Practice Flow Skill

Use this skill when implementing, auditing, polishing, or testing Exam Mode and Practice flows for the Nihongo BJT mobile app.

## Goal

Build a production-grade BJT practice and exam experience.

The flow must be:

* focused
* reliable
* mobile-native
* readable for Japanese/Vietnamese
* consistent with the web app
* serious enough for BJT/business learning
* not game-like unless explicitly gamified
* safe from navigation/timer/state bugs
* fully testable with fake repositories/providers

This skill covers:

* practice entry
* exam mode entry
* question player
* scenario display
* answer option selection
* submit/check answer
* next/previous behavior
* timer if supported
* progress indicator
* result screen
* explanation screen
* per-question review
* retry
* saved/review integration
* weak-point/mistake integration
* listening/audio question support if API supports it
* fullscreen focused route behavior
* widget and integration tests

## Core principle

Practice and Exam flows are focused learning sessions.

They should not feel like normal browsing screens.

Use fullscreen routes when needed.

Do not show bottom navigation in flows where it can compete with:

* answer options
* sticky CTA
* timer
* review action
* reveal action
* submit action

## Hard rules

* Do not fake questions.
* Do not fake exam scores.
* Do not fake timer/session state.
* Do not fake answer correctness.
* Do not invent API responses.
* Do not mark API as missing unless repo search proves it.
* If web has exam/practice API, inspect and reuse the contract.
* If backend runtime is down, implement against real contract and document runtime verification blocked.
* CTA must never look enabled when it cannot act.
* Tapping Next must advance exactly once.
* User must never get stuck on a middle question.
* Result/Explanation must be reachable when the flow expects it.
* Do not reintroduce bottom navigation into focused Practice/Exam/Flashcard Review if it causes layout/touch conflicts.
* Do not store credentials.
* Do not modify backend/database unless explicitly required.
* Keep VI/JA localization in sync.
* Support 360–390 dp width.
* Support dark mode.
* Support long Japanese/Vietnamese text.
* Add/update tests.

## Required audit before coding

Inspect:

### Web

* web practice flow
* web exam mode flow
* web question player
* web result screen
* web explanation/review screen
* web timer/session logic
* web API clients/hooks/services
* web DTO/models/types
* web saved/review/mistake integration
* web audio/listening question behavior if any
* web loading/error/empty behavior

### Mobile

* current practice page
* current result/explanation page
* current exam mode page if any
* current router/fullscreen routes
* current AppShell
* current question models/providers/repositories
* current saved/review/weak-point providers
* current l10n
* current tests:

  * practice tests
  * navigation tests
  * long-text tests
  * dark-mode tests
  * integration tests if any

Create/update:

* `docs/mobile/EXAM_PRACTICE_WEB_PARITY_AUDIT.md`
* `docs/mobile/EXAM_PRACTICE_API_CONTRACT.md`
* `docs/mobile/EXAM_PRACTICE_STATE_MACHINE.md`
* `docs/mobile/EXAM_PRACTICE_UX_DECISION.md`
* `docs/mobile/EXAM_PRACTICE_IMPLEMENTATION_PLAN.md`

## Required state machine documentation

`EXAM_PRACTICE_STATE_MACHINE.md` must document:

* initial loading
* session creation
* question loaded
* answer selected
* answer submitted
* feedback shown
* next question
* previous question if supported
* skipped question if supported
* timer running
* timer paused if supported
* timeout
* auto-submit on timeout if web supports it
* manual submit
* result loading
* result shown
* explanation shown
* retry
* save/review action
* error state
* offline/backend unreachable state

For every state, document:

* allowed user actions
* disabled actions
* CTA label
* navigation behavior
* API call if any
* expected UI state
* tests required

## Required screens

Implement or polish:

### 1. Practice Entry

* start practice
* resume practice if supported
* choose lesson/category if supported
* clear empty/error/loading state
* no fake available practice count

### 2. Exam Mode Entry

* exam list or exam start if API supports it
* estimated time/question count only if real data exists
* exam rules/intro if web has it
* start/resume action
* unavailable state if backend/runtime blocked

### 3. Question Player

Must support:

* scenario/context
* question prompt
* Japanese text
* Vietnamese helper/explanation only where appropriate
* answer options
* selected answer state
* disabled/enabled submit state
* check/submit behavior
* next behavior
* progress indicator
* timer if supported
* fullscreen focused layout
* sticky CTA that never covers content
* safe bottom padding
* no bottom nav conflict
* long Japanese/Vietnamese text
* dark mode

### 4. Result / Explanation

Must support:

* score/result if real
* correct answer
* user answer
* explanation
* business manner point if API/data supports it
* vocabulary/phrase section if data supports it
* retry/review/save actions if supported
* per-question review summary
* weak-point classification if real
* no fake score or fake analytics

### 5. Review after Exam

If web supports it:

* question list
* correct/incorrect/skipped status
* jump to explanation
* retry wrong questions
* save item
* add to flashcard/review if supported

### 6. Listening/Audio Questions

Only if API/assets support it:

* play audio button
* loading audio state
* failed audio state
* no autoplay unless product requires it
* transcript visibility if web supports it
* no fake audio

## UI/UX rules

Practice/Exam should feel:

* focused
* calm
* serious
* premium
* trustworthy
* clear under pressure
* readable for long Japanese scenarios
* fast to operate with one hand

Avoid:

* cluttered dashboard layout
* bottom nav during focused session
* tiny answer options
* ambiguous CTA
* aggressive red/green
* too much animation
* fake gamified score
* unreadable dense explanation
* desktop-like table layout

## CTA rules

CTA must be deterministic.

Examples:

* no answer selected → disabled Submit/Check
* answer selected but not submitted → enabled Submit/Check
* submitted and not last question → enabled Next
* submitted and last question → enabled Finish/Result
* loading → disabled with progress state
* error → Retry
* timeout → Submit/Result according to web behavior

Never show enabled CTA that cannot act.

## Navigation rules

* Practice/Exam sessions should be fullscreen when CTA or timer is important.
* Back behavior must be explicit.
* If leaving a session may lose progress, show confirmation if web/product supports it.
* Result screen should have clear next action.
* Explanation should not trap the user.
* Deep links must not break auth guard.

## Sensory rules

Use `bjt-mobile-sensory-design` if available.

Allowed sensory feedback:

* answer selected: subtle visual + optional selection haptic
* answer submitted: subtle visual + optional light haptic
* correct/incorrect: clear but calm feedback
* lesson/exam complete: subtle completion emphasis
* no unexpected sound
* no distracting animation
* respect reduced-motion where feasible

## Required tests

Add/update tests for:

### State

* question loading
* question loaded
* answer selection
* submit disabled before selection
* submit enabled after selection
* submit shows feedback
* Next advances question 1
* Next advances middle question
* last question goes to result
* repeated Next tap does not double-advance
* error state
* retry state

### UI

* 360 dp layout
* dark mode
* long Japanese scenario
* long Vietnamese explanation
* answer option wrapping
* CTA not covering content
* fullscreen route hides bottom nav
* result/explanation reachable

### API/provider

* session start success
* session start error
* answer submit success
* answer submit error
* result fetch success
* result fetch error
* timeout if supported

### Integration

Add integration test if feasible:

* Learn/Home → Practice start → answer Q1 → next → answer Q2 → finish → result/explanation
* Exam entry → start session → answer → finish → result if mockable

Do not require real credentials in tests.

Use fake repositories/providers in tests.

## Flutter skills to use

Use:

* `flutter-build-responsive-layout`
* `flutter-fix-layout-issues`
* `flutter-add-widget-test`
* `flutter-add-widget-preview`
* `flutter-add-integration-test`
* `flutter-use-http-package` if relevant
* `flutter-implement-json-serialization` if relevant
* `flutter-apply-architecture-best-practices`

## Verification

After every batch:

```bash
cd mobile && flutter analyze
cd mobile && flutter test
git diff --check
```

If available:

```bash
cd mobile && flutter build apk --debug
```

Stop if verification is red.

## Final docs

Create/update:

* `docs/mobile/EXAM_PRACTICE_WEB_PARITY_AUDIT.md`
* `docs/mobile/EXAM_PRACTICE_API_CONTRACT.md`
* `docs/mobile/EXAM_PRACTICE_STATE_MACHINE.md`
* `docs/mobile/EXAM_PRACTICE_UX_DECISION.md`
* `docs/mobile/EXAM_PRACTICE_IMPLEMENTATION_PLAN.md`
* `docs/mobile/EXAM_PRACTICE_RETEST_CHECKLIST.md`
* `docs/mobile/EXAM_PRACTICE_RETEST_PROMPT_FOR_CODEX.md`
* `docs/mobile/MOBILE_KNOWN_LIMITATIONS.md`
* `docs/mobile/MOBILE_MANUAL_QA_CHECKLIST.md`

## Final response required

When using this skill, final response must include:

1. Web parity summary
2. API/data contract summary
3. State machine summary
4. Practice flow changes
5. Exam mode changes
6. Result/explanation changes
7. UI/UX polish completed
8. Tests added/updated
9. Verification results
10. Remaining limitations
11. Codex retest prompt path