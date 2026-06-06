# Deck / Flashcard Management — Mobile Migration Map

Status: Batch 0 audit. Classifies the existing `apps/mobile` Deck/Flashcard
implementation before the Quizlet-like Create Set upgrade. No code is rewritten
from scratch; the data/domain layer is production-grade and is preserved.

Scope root: `apps/mobile/lib/features/flashcards/`

## Summary

The existing implementation is mature. The data layer (API + cached + mock
repositories, DTO mapper, drift cache, offline review queue, review sync) and
domain layer (validated form inputs mirroring the backend Zod schemas) are
**kept as-is**. The single structural gap is that mobile **Create Deck is a
two-step flow** (create empty deck → open detail → bulk-add cards), while the
web and the backend support a **one-step create** (`POST
/api/flashcards/decks` accepts a `cards` array). The upgrade adds a
`createDeckWithCards` repository method and a new one-step Create Set screen,
extracts a reusable multi-card row editor + import parser, and retires the
metadata-only create path. Edit-metadata, single-card edit, bulk-add-to-deck,
review and reveal are preserved.

## Classification

### Keep as-is (do not modify behavior)

| File | Reason |
| --- | --- |
| `domain/flashcard_repository.dart` | Interface; only **extended** with one new method (additive). |
| `domain/flashcard_deck.dart`, `flashcard.dart`, `deck_detail.dart` | Models match contract. |
| `domain/deck_form_input.dart` | Validators/limits mirror backend exactly. |
| `domain/deck_card_input.dart` | Validators/limits mirror backend exactly. |
| `domain/srs_rating.dart`, `review_mode.dart`, `typed_answer_grading.dart` | Review/SRS domain. |
| `domain/add_term_to_deck.dart`, `add_mistakes_to_deck.dart` | Use-cases, unaffected. |
| `data/api_flashcard_repository.dart` | Extended additively with `createDeckWithCards`. |
| `data/cached_flashcard_repository.dart`, `mock_flashcard_repository.dart` | Extended additively. |
| `data/flashcard_dto_mapper.dart`, `dto/*`, `local/*` | DTO + cache, unchanged. |
| `data/offline_review_queue.dart`, `flashcard_review_sync_service.dart` | Offline/sync, unchanged. |
| `presentation/flashcard_review_page.dart` | Review + reveal behavior — must not change. |
| `presentation/flashcard_sign_in_required_view.dart` | Auth gate UI. |
| `presentation/add_term_to_flashcard_sheet.dart` | Reading-assist add-to-deck. |
| `presentation/flashcard_card_form_page.dart` | Single-card edit/delete. |
| All `test/features/flashcards/*` | Preserve; extend with new coverage. |

### Refactor (additive, no behavior loss)

| File | Change |
| --- | --- |
| `domain/flashcard_repository.dart` | Add `createDeckWithCards(meta, cards) → String`. |
| `data/api_flashcard_repository.dart` | Implement `createDeckWithCards` = `POST /decks` with `cards`. |
| `data/cached_flashcard_repository.dart` | Delegate + invalidate cache. |
| `data/mock_flashcard_repository.dart` | In-memory create with cards. |
| `presentation/flashcard_providers.dart` | Add `createWithCards` to `DeckMutationController`. |
| `presentation/flashcard_card_bulk_add_page.dart` | Reuse extracted shared row editor + import; no flow change (still appends to existing deck). |

### Replace (retire the duplicate create path)

| File / route | Change |
| --- | --- |
| `presentation/flashcard_deck_form_page.dart` (create mode) | The metadata-only create branch is retired; `FlashcardDeckFormPage` becomes **edit-only** (`deckId` required). |
| Route `flashcardCreate` (`/review/flashcards/new`) | Re-pointed from `FlashcardDeckFormPage()` to the new `FlashcardCreateSetPage()`. |

### New (the upgrade)

| File | Purpose |
| --- | --- |
| `presentation/flashcard_create_set_page.dart` | One-step Quizlet-like Create Set (metadata + multi-card editor + import + unsaved guard). |
| `presentation/widgets/deck_card_editor_row.dart` | Reusable card row block (front/back/reading, validation, remove). |
| `presentation/widgets/deck_card_import_sheet.dart` | Paste-import UI (parse → preview → replace/append). |
| `domain/deck_card_import.dart` | Pure parser (tab/pipe/comma/dash separators, row-level errors). |

### Remove as dead/duplicate

None at audit time. After re-pointing `flashcardCreate`, the metadata-only
create branch of `FlashcardDeckFormPage` is deleted (not left dead). No dead
routes or buttons remain — every create entry point resolves to the new
one-step screen.

## Route ownership risks

- Flashcards live under the **Review** shell branch
  (`/review/flashcards/...`), so the Review tab stays selected — preserved.
- The new Create Set page is pushed under the same branch; tab ownership is
  unchanged.
- Focused review (`flashcardReview`) keeps its existing nav behavior; the
  upgrade does not touch it.

## Review / SRS risks

- `saveDeckCards`/`createDeckWithCards` send the full card set; the backend
  preserves shared `cardId`/`deckCardId` and SRS rows. Create sends new rows
  only (no ids), so no SRS rows are disturbed.
- Reveal/grade flow (`flashcard_review_page.dart`,
  `reviewSessionProvider`) is untouched.

## Rollback notes

- The new method is additive: reverting the route re-point restores the old
  two-step flow without data migration.
- No schema/endpoint changes are required — the backend already supports
  one-step create.
- New files are self-contained; deleting them + restoring the create branch in
  `flashcard_deck_form_page.dart` + the route fully reverts the upgrade.
