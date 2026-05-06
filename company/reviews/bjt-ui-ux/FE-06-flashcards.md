# FE-06 Flashcards/SRS — Screen Contract

**Status**: `verified`
**Route**: `/[locale]/flashcards`
**Files**: `apps/web/app/[locale]/flashcards/page.tsx`, `apps/web/app/[locale]/flashcards/_components/flashcards-client.tsx` (614 lines)

## Product Context

- **Target user**: Authenticated learner reviewing vocabulary/grammar
- **Primary learner outcome**: Review due flashcards via SRS, create new cards
- **Primary action**: Review due card → flip → rate difficulty
- **Secondary actions**: Browse deck, create card, upload image, view stats
- **Non-goals**: Shared/community decks (future)

## Data Contract

- **Backend APIs**: SRS review queue, card CRUD, image upload
- **Auth**: `useKeycloakAuth()` — userId from token
- **Offline queue**: `offlineReviewQueue` for network-resilient reviews
- **Image upload**: Validated mime types (jpeg, png, webp, gif), max 10MB

## Implementation Quality

- Auth-gated via `useKeycloakAuth()` ✅
- SRS review flow: due cards → flip → rate ✅
- Offline review queue: `drainForUser`, `enqueueReview`, `queueSizeForUser` ✅
- Image upload with type/size validation ✅
- Shared UI components: `Card`, `CardContent`, `PageHeader` ✅
- `generateMetadata` with localized title ✅

## States

| State | Implementation | Status |
|-------|---------------|--------|
| Loading cards | Fetch due cards from API | ✅ |
| Review mode | Card front → flip → rate | ✅ |
| Empty deck | No cards due message | ✅ |
| Card creation | Form with front/back/reading/image | ✅ |
| Offline queued | Reviews queued locally, drain on reconnect | ✅ |
| Error | API failure message | ✅ |

## Localization

- **i18n namespace**: `flashcards`
- **VI/JA**: Both localized
- **Key fixes applied**: "Flashcard" → "Thẻ từ", "SRS" removed

## Acceptance

- [x] Auth-gated
- [x] SRS algorithm (server-side)
- [x] Offline resilience
- [x] Image upload validation
- [x] i18n complete
- [x] No technical text (MinIO/presigned removed)
