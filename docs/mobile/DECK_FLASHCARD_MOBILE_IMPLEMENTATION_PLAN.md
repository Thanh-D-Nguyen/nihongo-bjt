# Deck & Flashcard — Mobile Implementation Plan

Execution plan for full mobile Deck/Flashcard **management** parity. Built on
the real contract in `DECK_FLASHCARD_API_CONTRACT.md` and the gap analysis in
`DECK_FLASHCARD_WEB_PARITY_AUDIT.md`.

## Architecture decisions

- **Layering** follows the existing flashcard feature: `domain/` (models +
  repository interface), `data/` (DTOs, mapper, API repo), `presentation/`
  (pages, providers). No new dependencies.
- **Repository extension, not replacement.** Add deck/card management methods to
  `FlashcardRepository` and implement them in `ApiFlashcardRepository` and
  `MockFlashcardRepository`. `CachedFlashcardRepository` delegates writes
  straight through (no cache for mutations) and invalidates the deck cache.
- **Server-derived identity.** No `userId` in any request body/query.
- **Routing.** Deck management lives under the **Review** shell branch so the
  Review tab stays selected (ANDROID-QA-P2-002). New nested routes under
  `/review/flashcards`:
  - `/review/flashcards` → deck list (existing)
  - `/review/flashcards/:deckId` → **deck detail** (new)
  - `/review/flashcards/new` → **create deck** (new)
  - `/review/flashcards/:deckId/edit` → **edit deck** (new)
  - `/review/flashcards/:deckId/cards/new` → **create card** (new)
  - `/review/flashcards/:deckId/cards/:cardId/edit` → **edit card** (new)
  - The focus **review** flow stays at top-level `/flashcards/:deckId/review`
    (unchanged) so bottom nav never competes during recall.
- **Card mutation contract.** Because deck PATCH replaces the whole card set,
  the card form providers load the deck's current cards, apply one change
  (add/edit/remove), and PATCH the **complete** list. Encapsulated in a
  `DeckEditController` so screens never hand-assemble the array.

## Domain model changes

- Extend `FlashcardDeck` with: `titleVi`, `titleJa`, `descriptionVi`,
  `descriptionJa`, `visibility (private|public)`, keep `cardCount`. Keep a
  computed `displayTitle` (JA-first, VI fallback) so the list UI is unchanged.
- New `DeckCard` domain model: `deckCardId`, `cardId`, `frontText`, `backText`,
  `reading`, `position`, optional `imageUrl`, `examples`.
- New `DeckDetail` model: deck fields + `List<DeckCard>`.
- Keep `Flashcard` (review item) untouched — review path unchanged.

## Repository interface additions

```dart
Future<DeckDetail> fetchDeckDetail(String deckId);
Future<FlashcardDeck> createDeck(DeckDraft draft);          // metadata + optional cards
Future<FlashcardDeck> updateDeckMeta(String deckId, DeckMetaDraft draft);
Future<void> archiveDeck(String deckId);
Future<DeckDetail> saveCards(String deckId, List<DeckCardDraft> cards); // full set PATCH
```
`DeckDraft` / `DeckMetaDraft` / `DeckCardDraft` are immutable input models built
by the form controllers and serialized to the exact Zod-validated bodies.

## Batch breakdown

### Batch 1 — Deck list foundation
- Extend deck DTO/model/mapper (`visibility`, `descriptionJa`).
- Deck list: keep states; add **OfflineBanner** + search field + filter chips
  (my/public/recent) wired to the real payload. Create-deck FAB.
- Tile now navigates to **deck detail** (not straight to review).
- l10n VI/JA. `flutter analyze` + `flutter test`.

### Batch 2 — Deck detail + actions
- `DeckDetail` model + `fetchDeckDetail` (API + mock + cached).
- Deck detail page: metadata header, real card count, **Study** CTA (→ review),
  card list, edit/archive actions (archive uses POST alias + confirm dialog).
- `deckDetailProvider(deckId)` family. All states. Routes added.

### Batch 3 — Create/Edit deck form
- `createDeck` / `updateDeckMeta` + `DeckEditController`.
- Native form: titleVi (required), titleJa, descriptionVi, descriptionJa,
  visibility toggle. Inline validation mirroring Zod limits. Keyboard-safe,
  no overflow. Success → pop + invalidate list/detail. Widget tests + preview.

### Batch 4 — Flashcard list in deck
- Card list section on deck detail with search + sort (front/recent) over the
  loaded cards. Empty/loading/error states. Create-card CTA.

### Batch 5 — Create/Edit/Delete flashcard
- Card form: frontText (JA, required), backText (VI/explanation, required),
  reading (optional kana). Validation to Zod limits.
- `saveCards` full-set PATCH via `DeckEditController` (add/edit/remove).
- Delete confirmation flow. Tests for each path.

### Batch 6 — Review/SRS integration polish
- Wire per-deck review via `deckId` query on the due endpoint.
- Verify reveal still works, no bottom-nav conflict, Review tab stays active.
- Regression test for the Review → deck list → detail → review route.

### Batch 7 — UI/UX production polish
- Apply design tokens, micro-interactions, dark mode, 320–390 dp safety,
  JA line-height ≥1.8 / VI ≥1.5, 48dp targets, focus rings. Self-audit pass.

### Batch 8 — Tests + retest docs
- Widget tests for every screen/state + an integration test of the full flow.
- Update `MOBILE_KNOWN_LIMITATIONS.md`, `MOBILE_MANUAL_QA_CHECKLIST.md`.
- Create `DECK_FLASHCARD_RETEST_CHECKLIST.md` +
  `DECK_FLASHCARD_RETEST_PROMPT_FOR_CODEX.md`.

## Verification per batch
`cd apps/mobile && flutter analyze` (clean) and `flutter test` (pass).
`git diff --check`. Stop on red. `flutter build apk --debug` only if an Android
SDK is present (none in CI env — analyze+test are the gates).

## Guardrails
- Do not regress `flashcard_review_page.dart` or the Review tab routing.
- No `userId` in requests. No faked data. No swallowed errors.
- Free-form card images omitted (no mobile upload endpoint) — documented.
