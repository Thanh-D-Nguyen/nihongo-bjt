# FE-16 Daily Item Detail — Screen Contract

**Status**: `verified`
**Route**: `/[locale]/daily/[id]`
**Files**: `apps/web/app/[locale]/daily/[id]/page.tsx`, `apps/web/app/[locale]/daily/[id]/daily-detail-client.tsx` (330+ lines)

## Product Context

- **Target user**: Learner viewing a specific daily content item (phrase, grammar, NHK article, Life-in-Japan topic)
- **Primary learner outcome**: Learn/review Japanese content with reading assistance
- **Primary action**: Read Japanese content with furigana/meaning hover
- **Secondary actions**: Generate flashcards, quick quiz, mark useful
- **Non-goals**: Content editing (admin only)

## Data Contract

- **Backend APIs**: `GET /api/daily/items/:id`, `POST /api/daily/items/:id/generate-flashcards`, `POST /api/daily/items/:id/quick-quiz`, `POST /api/daily/items/:id/mark-useful`
- **Auth**: Optional (guest can view, auth required for actions)
- **Content types**: DAILY_PHRASE, GRAMMAR_TIP, KANJI_SPOTLIGHT, NHK_NEWS, LIFE_IN_JAPAN

## Implementation Quality

- Loading skeleton: 3-element animated pulse ✅
- Error state: localized message + back-to-home link ✅
- Breadcrumb navigation: Home / Kind ✅
- Kind badge: accent chip with content type ✅
- Date formatting: locale-aware (`toLocaleDateString`) ✅
- Japanese content block with reading assist ✅
  - Authenticated: `AnnotatedJapaneseText` with hover mode ✅
  - Guest: plain `jp-text` display ✅
- Furigana/reading section ✅
- Explanation section ✅
- Body markdown with per-paragraph Japanese detection ✅
- Learning safeguard for Life-in-Japan topics ✅
  - Learning objective, risk disclaimer, source, remediation links ✅
- Action buttons: generate flashcards, quick quiz, mark useful ✅
- Action feedback: 3-second success/error toast ✅
- Source link with external link indicator ✅
- `generateMetadata` with localized title ✅

## States

| State | Implementation | Status |
|-------|---------------|--------|
| Loading | Animated skeleton | ✅ |
| Not found | Error message + home link | ✅ |
| Load error | Error message + home link | ✅ |
| Content display | Full detail with all sections | ✅ |
| Guest view | Japanese text without reading assist | ✅ |
| Auth view | Japanese text with AnnotatedJapaneseText | ✅ |
| Action success | 3-second toast message | ✅ |
| Action error | 3-second error toast | ✅ |
| Life-in-Japan | Safeguard section with disclaimer | ✅ |

## Localization

- **i18n namespace**: `dailyDetail`, `daily`
- **VI/JA**: Both localized
- **Copy keys**: home, backToHome, japaneseContent, reading, explanation, source, readMore, errorNotFound, errorLoad, markedUseful, widget kind labels, life safeguard labels

## Acceptance

- [x] Reading assist integration
- [x] Guest/auth differentiation
- [x] Life-in-Japan safeguard
- [x] Loading/error/not-found states
- [x] Action buttons with feedback
- [x] Breadcrumb navigation
- [x] Locale-aware date formatting
- [x] i18n complete
