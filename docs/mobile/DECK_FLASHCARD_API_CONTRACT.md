# Deck & Flashcard — Real API Contract (Mobile)

Source of truth for the mobile Deck/Flashcard management slice. Every endpoint
below is taken from the live backend controllers and shared Zod schemas — no
invented routes, no invented fields.

- Backend controllers:
  - `apps/api/src/flashcards/flashcards.controller.ts` (`/api/flashcards/*`)
  - `apps/api/src/flashcards/canonical-flashcards.controller.ts`
    (`/api/decks/*`, `/api/review/*`)
- Validation schemas: `packages/shared/src/index.ts`
- Repository semantics: `apps/api/src/flashcards/flashcards.repository.ts`

## Auth & identity

- Every endpoint is guarded by `KeycloakAuthGuard` (bearer token).
- The learner id is resolved **server-side** from the verified token via
  `resolveLearnerUserId`. The mobile client therefore **must not** send
  `userId` in bodies/queries — the server injects it before Zod validation.
  (Matches the existing `submitReviewRating` pattern in
  `api_flashcard_repository.dart`.)
- 401/403 → mapped to "Bạn cần đăng nhập…" in the repository layer.

## Endpoints used by mobile

### List decks
`GET /api/flashcards/decks?limit=<n>` (canonical alias: `GET /api/decks`)

Response: array of decks.
```jsonc
{
  "id": "uuid",
  "titleVi": "string",          // always present
  "titleJa": "string|null",
  "descriptionVi": "string|null",
  "descriptionJa": "string|null",
  "visibility": "private|public",
  "status": "active|archived",
  "_count": { "cards": 12 }
}
```
Mobile DTO already models `id`, `titleVi`, `titleJa`, `descriptionVi`,
`_count.cards`. Extended in Batch 1 with `descriptionJa`, `visibility`.

### Deck detail (with cards)
`GET /api/decks/:id` → `service.deckDetailForLearner`

Returns the deck plus ordered cards. Only decks that are `active` and either
owned by the learner or `public` are returned (else 404).
```jsonc
{
  "id": "uuid",
  "titleVi": "string",
  "titleJa": "string|null",
  "descriptionVi": "string|null",
  "descriptionJa": "string|null",
  "visibility": "private|public",
  "status": "active",
  "ownerUserId": "uuid|null",
  "cards": [
    {
      "id": "deckCardId",
      "deckId": "uuid",
      "cardId": "uuid",
      "position": 0,
      "card": {
        "id": "uuid",
        "frontText": "会議",
        "backText": "Cuộc họp",
        "reading": "かいぎ",
        "sourceType": "reading_assist|lexeme|kanji|grammar|daily_content",
        "examples": [
          { "id": "uuid", "japaneseText": "…", "reading": "…|null",
            "translationVi": "…|null", "sourceKind": "grammar|kanji|lexeme" }
        ],
        "mediaLinks": [ { "asset": { "readUrl": "…", "mimeType": "…" } } ]
      }
    }
  ]
}
```

### Create deck
`POST /api/flashcards/decks` (canonical alias: `POST /api/decks`)

Body (Zod `createDeckSchema`, `userId` injected server-side):
```jsonc
{
  "titleVi": "string (1..120, required)",
  "titleJa": "string (1..120)?",
  "descriptionVi": "string (..500)?",
  "descriptionJa": "string (..500)?",
  "visibility": "private|public (default private)",
  "cards": [                                  // optional, max 200
    {
      "frontText": "string (1..500, required)",
      "backText":  "string (1..2000, required)",
      "reading":   "string (..300)?",
      "imageUrl":  "http(s) url (..2048)?"     // XOR primaryImageAssetId
    }
  ]
}
```
Returns the created deck (id + counts).

> **One-step create (Quizlet flow):** mobile now sends the `cards[]` array on
> create (`createDeckWithCards`), so a deck and its cards are persisted in a
> single `POST`. Cards on create carry no `cardId`/`deckCardId` (all new).

### Update deck (metadata + cards)
`PATCH /api/flashcards/decks/:deckId` (alias `PATCH /api/decks/:id`)

Body (Zod `updateDeckSchema`): same as create, but each card row may also
carry `cardId`/`deckCardId` to target an existing card.

**Card-array semantics (verified in `updateOwnedDeckForLearner`):**
- If `cards` is **omitted** → only deck metadata is updated; cards untouched.
- If `cards` is **present** → it is the **full desired set**. The server deletes
  all existing `deckCard` links, then recreates from the array in order:
  - row with matching `cardId`/`deckCardId` → updates that variant's
    `frontText`/`backText`/`reading`.
  - row without a match → creates a new variant (`sourceType: reading_assist`,
    random `sourceId`).
  - any existing card not present in the array → **removed** from the deck.
- Therefore: **add card** = send current cards + new row; **edit card** = send
  current cards with one row changed; **delete card** = send current cards minus
  one row. Mobile must always send the *complete* card list on a card mutation.

Only the deck `ownerUserId === learner` may update (else 404 `deck_not_found`).

### Archive (delete) deck
`POST /api/flashcards/decks/:deckId/archive` (POST alias — preferred on mobile
because `ApiClient` has no `deleteJson`). Empty/`{}` body.

Equivalent: `DELETE /api/flashcards/decks/:deckId`. Soft-deletes (sets
`status=archived`), unlinks cards, prunes orphaned SRS rows. Owner-only.

### Add card from canonical content (dictionary-linked)
`POST /api/decks/:deckId/cards` (alias `POST /api/flashcards/cards/from-content`)

Body (Zod `createCardFromContentSchema`):
```jsonc
{
  "frontText": "string (1..500)",
  "backText":  "string (1..1000)",
  "reading":   "string (..300)?",
  "sourceId":  "uuid (canonical content id)",
  "sourceType":"lexeme|kanji|grammar|reading_assist|daily_content"
}
```
Requires a real canonical `sourceId`. **Not** used for free-form card creation
on mobile — free-form cards go through the deck PATCH path above.

### Review / SRS (already wired — do not regress)
- `GET /api/flashcards/reviews/due?limit=<n>&deckId=<id>` — due queue. The
  endpoint **does** accept `deckId` (see `dueReviewsForLearner(userId, limit,
  deckId)`), enabling per-deck review. Canonical alias: `GET /api/review/next`.
- `POST /api/flashcards/reviews/:userFlashcardId` body `{ "rating":
  "again|hard|good|easy" }` — single grade. Alias: `POST /api/review`.
- `POST /api/flashcards/reviews/batch` — offline-sync batch (already used).

## Mobile mapping summary

| Mobile action            | HTTP                                             |
|--------------------------|--------------------------------------------------|
| Deck list                | `GET /api/flashcards/decks`                       |
| Deck detail + cards      | `GET /api/decks/:id`                              |
| Create deck              | `POST /api/flashcards/decks`                      |
| Edit deck metadata       | `PATCH /api/flashcards/decks/:id` (no `cards`)    |
| Add/edit/delete card     | `PATCH /api/flashcards/decks/:id` (full `cards`)  |
| Archive deck             | `POST /api/flashcards/decks/:id/archive`          |
| Per-deck review queue    | `GET /api/flashcards/reviews/due?deckId=:id`      |
| Submit grade             | `POST /api/flashcards/reviews/:userFlashcardId`   |

## Notes / constraints

- `backText` max differs by path: 2000 (deck cards) vs 1000 (from-content).
  Mobile free-form card editor uses the 2000 limit (deck PATCH path).
- A card without an `imageUrl`/`primaryImageAssetId` is valid. Mobile MVP does
  not upload images (no asset-upload endpoint wired on mobile yet) — image
  fields are omitted. Documented as a known limitation, not a fake.
- Per-deck due review depends on the learner having `user_flashcard` rows for
  that deck's cards; a freshly created free-form deck may have an empty due
  queue until cards are seeded into SRS server-side. This matches web behavior.
