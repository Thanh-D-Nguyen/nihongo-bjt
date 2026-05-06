# FE-05 Reading Assist Layer — Screen Contract

**Status**: `verified`
**Route**: N/A (reusable component layer)
**Files**: `apps/web/components/reading-assist/annotated-japanese-text.tsx`

## Product Context

- **Target user**: Any learner viewing Japanese text
- **Primary learner outcome**: Understand Japanese text via hover/tap for furigana, meanings, and add-to-flashcard
- **Primary action**: Hover/tap on Japanese word → see reading + meaning
- **Secondary actions**: Add word to flashcard deck
- **Non-goals**: Full dictionary (search page), inline editing

## Data Contract

- **Backend APIs**: `/api/reading-assist/analyze` (text analysis), `/api/reading-assist/analytics` (usage tracking)
- **Auth**: Requires userId for analytics and flashcard creation
- **Guest behavior**: Falls back to plain text display (no analysis)

## Implementation Quality

- `AnnotatedJapaneseText` component with configurable display mode ✅
- `displayMode: "hover"` for desktop, tap for mobile ✅
- Labels passed via `readingAssistLabels` i18n prop ✅
- Used across: quiz questions, daily detail, body markdown ✅
- Accessibility: a11y tests exist ✅
- Network: graceful degradation on API failure ✅

## Integration Points

| Surface | Usage | Status |
|---------|-------|--------|
| Quiz (FE-03) | Question prompts | ✅ |
| Daily detail (FE-16) | Japanese text + body paragraphs | ✅ |
| Dashboard (FE-01) | Daily content | ✅ |

## BJT Rules

- Practice mode: reading assist allowed ✅
- Timed exam mode: reading assist should be blocked (future)

## Localization

- **i18n namespace**: `readingAssist`
- **VI/JA**: Labels localized via prop injection

## Acceptance

- [x] Hover/tap interaction
- [x] Guest fallback to plain text
- [x] Used across multiple routes
- [x] a11y tests
- [x] Network failure graceful degradation
- [x] i18n labels
