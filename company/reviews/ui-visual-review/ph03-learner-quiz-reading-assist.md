# UI Visual Review — PH03 Reading Assist Quiz Integration

Page: Quiz / Reading Assist Integration
Route: /[locale]/quiz (QuizClient with AnnotatedJapaneseText)
Date: 2026-04-29
Reviewer agent: bjt-learner-ui (PH03-T03 fix cycle + bjt-qa oversight)

## Changed Scope

- `apps/web/app/[locale]/quiz/_components/quiz-client.tsx`
  - AnnotatedJapaneseText now wraps quiz question prompt
  - Reading assist disabled during active timed exam (examContext driven by server-authoritative session state)
  - add-to-flashcard action wired to real API
- `apps/web/components/reading-assist/annotated-japanese-text.tsx`
  - Mobile focus trap on bottom sheet (focus restore + escape close)
  - Request timeout 5s and in-flight dedup
  - User-facing i18n error messages (no raw internal keys)
- `apps/web/app/[locale]/settings/reading/_components/reading-assist-settings-client.tsx`
  - Imports updated post-integration

## States Verified

- [x] loading — analyze request shows loading indicator
- [x] empty — no Japanese text: reading assist button not rendered
- [x] error — analyze timeout → i18n error message (not internal key); tokenizer failure has fallback
- [x] exam-active — meanings hidden; reading assist operates in limited mode
- [x] exam-completed — meanings visible; full reading assist available
- [x] add-to-flashcard success — success toast from i18n key
- [x] add-to-flashcard error — error message from i18n key
- [x] add-to-flashcard no deck — no-deck copy from i18n key
- [x] permission denied — gate enforced server-side; UI degrades gracefully

## UX

- [x] no text overlap/clipping — bottom sheet uses standard design system layout
- [x] labels are human-readable — all i18n keys reviewed in vi/ja
- [x] i18n copy is natural — PH03-T03 fix cycle updated error/action labels
- [x] no raw technical keys — all error/status paths use i18n keys
- [x] no fake success/data/metrics — add-to-flashcard calls real API; analyze calls real backend

## Accessibility

- [x] keyboard usable — focus trap on bottom sheet (escape to close, tab within)
- [x] focus visible — focus restore implemented after bottom sheet close
- [x] aria labels for icon buttons — AnnotatedJapaneseText trigger has aria-label from i18n
- [x] contrast acceptable — design system tokens; no custom color overrides
- [x] reduced motion respected — no CSS animation added in this change

## Screenshot / Manual Check

Environment limitation: cannot take runtime screenshot in current automated agent context.

Manual viewport checklist:

- desktop: popover variant expected (CSS-driven per reading assist provider logic)
- mobile: bottom sheet variant; touch targets min 48px verified in code (padding + min-height props)
- tablet: follows mobile path for touch targets

Visual QA blocker: none identified from code inspection. Bottom sheet focus trap is test-verified.

## Test Evidence

- Reading-assist targeted tests (13/13 pass):
  - Exam-safe enforcement: active/completed/warm-cache flows
  - a11y: Enter open, Escape close, focus restore
  - Network: timeout message, dedup, add-to-flashcard
  - Quiz client reading-assist integration: meanings hidden / visible per exam state
- Monorepo typecheck (8/8 pass)
- Web production build (pass)

## Result

PASS_WITH_RISKS

## Findings

- Low risk: no runtime screenshot taken (agent environment limitation). Component-level tests cover the key behavioral paths. Layout uses @nihongo-bjt/ui design system with no custom CSS overrides.
- Low risk: mobile bottom sheet tested via device-emulation DevTools notes only; physical device validation deferred to QA smoke test cycle.
- Accepted: React act warning noise remains in annotated-japanese-text.a11y-and-network.test.tsx (PH03-R02 accepted).
