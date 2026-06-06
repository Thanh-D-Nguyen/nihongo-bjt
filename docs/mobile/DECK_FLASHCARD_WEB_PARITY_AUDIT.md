# Deck & Flashcard — Web ↔ Mobile Parity Audit

Audit of the web flashcard/deck management surface vs the current mobile slice,
with an explicit implementation decision per feature. No feature is marked
"deferred / missing backend" unless the API/client/model was searched and the
blocker is documented.

## Web surface (reference)

- Routes: `apps/web/app/[locale]/flashcards/page.tsx`,
  `apps/web/app/[locale]/flashcards/decks/[deckId]/page.tsx`
- Components: `flashcards-page-client.tsx` (Library/Review/Saved tabs),
  `deck-browser.tsx` (filter my/public/recent + title search),
  `deck-detail-client.tsx` (metadata, card list, study, archive),
  `deck-study-session.tsx` (flip/shuffle/quiz), `review-session.tsx` (SRS),
  `deck-composer-panel.tsx` (create/edit: manual entry, bulk import, add from
  content, image upload).

## Current mobile slice (baseline, before this work)

- `flashcard_deck_list_page.dart` — deck list; tile taps **straight into review**
  (no deck detail screen).
- `flashcard_review_page.dart` — SRS reveal/grade session (works, must not
  regress). Reached via full-screen route `/flashcards/:deckId/review`.
- Domain models are review-only: `FlashcardDeck{id,title,description,cardCount}`,
  `Flashcard{id,userFlashcardId,front,reading,back}`.
- Repository: `fetchDecks`, `fetchCards` (currently global due queue, **not**
  deck-scoped), `submitReviewRating`. No deck/card CRUD.
- Review tab → `ReviewHubPage` → `flashcards` (deck list) → review. Deck list
  lives under the Review shell branch so the Review tab stays selected.

## Parity matrix

Status legend: ✅ exists · 🟡 partial · ❌ missing (before this work).
Decision: **Implement now** · **API adapter** · **UX decision** · **N/A mobile**
· **Blocked (proof)**.

| # | Web feature | API / client | Mobile before | Decision | Screens | Tests |
|---|-------------|--------------|---------------|----------|---------|-------|
| 1 | Deck library list | `GET /api/flashcards/decks` | 🟡 list, no detail nav | Implement now | Deck list | list states |
| 2 | Deck title search | client-side filter | ❌ | Implement now | Deck list search bar | search filter |
| 3 | Deck filter (my/public/recent) | `visibility`/`createdAt` on list payload | ❌ | Implement now | Deck list filter chips | filter |
| 4 | Deck detail (metadata + card list) | `GET /api/decks/:id` | ❌ | Implement now | Deck detail | detail nav, populated/empty |
| 5 | Study / review entry from deck | `GET /reviews/due?deckId=` | 🟡 (global queue) | API adapter (add `deckId`) | Deck detail CTA | review route |
| 6 | Create deck (metadata) | `POST /api/flashcards/decks` | ❌ | Implement now | Create/Edit form | validation, success, error |
| 7 | Create deck with inline cards | same body `cards[]` | ❌ | Implement now | Card editor in flow | card add |
| 8 | Edit deck metadata | `PATCH /api/flashcards/decks/:id` | ❌ | Implement now | Create/Edit form | edit success |
| 9 | Delete / archive deck | `POST /decks/:id/archive` | ❌ | Implement now | Deck detail action | archive confirm |
| 10 | Flashcard list in deck | `GET /api/decks/:id` cards | ❌ | Implement now | Deck detail card list | list states |
| 11 | Flashcard search/sort in deck | client-side over card list | ❌ | Implement now | Card list controls | search/sort |
| 12 | Create flashcard (free-form) | `PATCH deck` full `cards[]` | ❌ | Implement now | Card form | validation/success |
| 13 | Edit flashcard | `PATCH deck` matched row | ❌ | Implement now | Card form | edit |
| 14 | Delete flashcard | `PATCH deck` minus row | ❌ | Implement now | Card list action | delete confirm |
| 15 | Add card from dictionary content | `POST /decks/:id/cards` | ❌ | UX decision → Phase next | — | — |
| 16 | Image upload per card | media upload endpoint | ❌ | Blocked (proof) | — | — |
| 17 | SRS reveal/flip review | `/reviews/due` + grade | ✅ | Keep / polish | Review page | reveal behavior |
| 18 | Quiz/match modes | client modes | ✅ flip only | N/A mobile (MVP keeps reveal) | — | — |
| 19 | Bulk import (CSV/JSON) | composer client parse | ❌ | N/A mobile (MVP) | — | — |
| 20 | Deck share / clone | `POST /decks/:id/share` | ❌ | UX decision → later | — | — |

### Blocked items (with proof)

- **#16 Image upload per card** — The card schema accepts `imageUrl` (http/s)
  or `primaryImageAssetId`, but there is **no media-upload endpoint wired into
  the mobile `ApiClient`** (web uploads via MinIO presign flow not present in
  `apps/mobile/lib/core/api`). Free-form cards are created without images; this
  is a documented limitation, not faked. Adding upload is a separate task.

### Deferred-with-reason (mobile UX scope, not backend-blocked)

- **#15 Add from dictionary content** — backend exists
  (`POST /decks/:id/cards` with `sourceId`/`sourceType`). Requires an in-flow
  dictionary picker; out of scope for this management-parity pass. Free-form
  card creation via deck PATCH fully covers create/edit/delete needs.
- **#18 quiz/match, #19 bulk import, #20 share/clone** — backend exists for
  share/clone; these are richer UX surfaces deferred to keep this pass focused
  on core management parity. Tracked in `MOBILE_KNOWN_LIMITATIONS.md`.

## Outcome targets for this pass

Implement #1–#14 and #17 (keep). The result is full **management** parity:
browse, search/filter, view detail, create/edit/archive decks, and
create/edit/delete free-form flashcards — all on real endpoints, with every
loading/empty/error/offline state and VI/JA localization.

---

## Upgrade Addendum — Quizlet-like Create Set (current pass)

The first pass (above) shipped management parity but left **create** as a
two-step flow (metadata-only create → open detail → bulk-add cards). The web and
backend support a **one-step** create (`POST /api/flashcards/decks` with a
`cards[]` array). This pass closes the remaining create/import gaps.

| # | Web feature | Mobile (before this pass) | Decision |
|---|-------------|---------------------------|----------|
| 7  | Create deck **with inline cards** (one request) | metadata-only create, cards added separately | **Implement now** — `createDeckWithCards`, new Create Set screen |
| 19 | Bulk import (paste term/def rows, preview, replace/append) | ❌ none | **Implement now** — import sheet + pure parser |
| 4b | Multi-card editor (add/remove rows, per-row validation) | exists only in append-to-deck bulk page | **Reuse** — extract shared `DeckCardEditorRow` |
| — | Unsaved-changes protection on create | none | **Implement now** — `PopScope` confirm |

Unchanged from the first pass (kept, not regressed): deck list, deck detail,
edit metadata, single-card CRUD, archive, review/reveal, route ownership.

Still deferred with reason (see `MOBILE_KNOWN_LIMITATIONS.md`): per-card image
upload (no mobile presign), reading auto-fill (reading-assist API not wired on
create), duplicate/share/export, quiz/match modes.
