# FE-09 Search — Screen Contract

**Status**: `verified`
**Route**: `/[locale]/search`
**Files**: `apps/web/app/[locale]/search/page.tsx`, `apps/web/app/[locale]/search/_components/search-client.tsx` (205 lines)

## Product Context

- **Target user**: Any learner looking up vocabulary, kanji, grammar, or examples
- **Primary learner outcome**: Find Japanese language reference material quickly
- **Primary action**: Type query → view results
- **Secondary actions**: Filter by kind (lexeme, kanji, grammar, example)
- **Non-goals**: Full dictionary application

## Data Contract

- **Backend APIs**: Search via API (Meilisearch projection)
- **Result type**: `SearchResult` from `@nihongo-bjt/shared`
- **No auth required**: Public search endpoint

## Implementation Quality

- Search input with localized placeholder ✅
- Kind filter chips: lexeme, kanji, grammar, example ✅
- Results with `Card`, `CardContent`, `SkillChip` components ✅
- Empty state: `EmptyState` component with i18n ✅
- Error state: error message ✅
- Loading state: loading indicator ✅
- `generateMetadata` with localized title ✅

## States

| State | Implementation | Status |
|-------|---------------|--------|
| Empty (no query) | Prompt with description | ✅ |
| Loading | Loading indicator | ✅ |
| Results | Filtered result cards | ✅ |
| No results | Empty state message | ✅ |
| Error | Error message | ✅ |
| Filter active | Kind filter chips | ✅ |

## Localization

- **i18n namespace**: `search`
- **VI/JA**: Both localized
- **Key fixes**: "từ vựng" not "dictionary"

## Acceptance

- [x] Public (no auth required)
- [x] Kind filtering
- [x] Shared UI components
- [x] Empty/error/loading states
- [x] i18n complete
