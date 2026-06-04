# NihonGo BJT — Mobile Deck & Flashcard Management Retest Checklist

Runtime verification for the mobile **deck / flashcard management** parity work
in `apps/mobile`. The feature is code-complete and passes `flutter analyze`
(clean) and `flutter test` (350 tests). This checklist is what a human must
confirm on a **running build** once a device/emulator is available.

Run every scenario in **light and dark**, in **Vietnamese and Japanese**, at
**320 dp** and a **large phone/tablet width**. Mark each step
**PASS / FAIL / BLOCKED (reason)**. Do not re-file items already in
`MOBILE_KNOWN_LIMITATIONS.md` §6a as new bugs.

> Companion docs: `MOBILE_KNOWN_LIMITATIONS.md`,
> `MOBILE_MANUAL_QA_CHECKLIST.md` (§9a),
> `MOBILE_DECK_FLASHCARD_RETEST_PROMPT_FOR_CODEX.md`.

## Setup

- [ ] `cd apps/mobile && flutter pub get`
- [ ] Local Keycloak + API reachable (see `/memories` infra notes / `README.md`).
- [ ] Run against the **real API** data source:
      `flutter run -d <device> --dart-define=FLASHCARD_DATA_SOURCE=api`
      (the in-memory mock is fine for UI-only checks, but per-deck review and
      full-set card writes must be validated against the real backend).
- [ ] Sign in with a learner account that **owns** at least one deck and can see
      at least one **public** deck owned by someone else.

## 1. Deck list (Review → Flashcards)

- [ ] List loads with all states: loading shimmer, populated, empty, error.
- [ ] Filter chips **All / Private / Public** show the honest subset (a public
      deck appears under All + Public; a private deck under All + Private).
- [ ] Empty filter result shows an encouraging empty state, not a blank screen.
- [ ] "Create deck" CTA is reachable from both the populated and empty states.

## 2. Create deck

- [ ] Required **title** validation blocks an empty save with a localized error.
- [ ] Over-max title / description show the localized too-long error.
- [ ] Visibility toggle (Private / Public) is respected.
- [ ] Save → returns to the list and the new deck is present with correct title,
      description and visibility.

## 3. Edit deck metadata

- [ ] Form is prefilled from the real deck (title VI/JA, description, visibility).
- [ ] Save persists; reopening the deck shows the updated metadata.
- [ ] Editing metadata does **not** wipe the deck's existing cards.

## 4. Archive deck

- [ ] Archive action shows a confirm dialog (cancel leaves the deck intact).
- [ ] Confirm → deck leaves the active list and the success SnackBar shows.

## 5. Deck detail — card list

- [ ] Header card shows title, description, visibility badge, card count.
- [ ] Study CTA is **disabled** when the deck has no cards.
- [ ] Search filters cards by **front / back / reading** (try a kanji, a kana
      reading, and a Vietnamese gloss substring).
- [ ] Sort toggle **Position / A–Z** reorders the visible list correctly.
- [ ] Result-count line appears while a query is active.
- [ ] Search with no matches shows the search-empty state.
- [ ] Tapping a card opens its edit form.

## 6. Add card

- [ ] Add CTA opens a blank card form.
- [ ] Required **front** and **back** block save with localized errors.
- [ ] Over-max front/reading/back show the localized too-long error.
- [ ] At 200 cards, adding shows the localized "card limit reached" message.
- [ ] Save → returns to deck detail with the new card visible in position order.

## 7. Edit card

- [ ] Form is prefilled (front, reading, back) from the real card.
- [ ] Update → change persists on the deck detail list.
- [ ] Out-of-range / removed card shows the localized "card not found" state.

## 8. Delete card

- [ ] Delete action shows a confirm dialog (cancel keeps the card).
- [ ] Confirm → card leaves the deck and the success SnackBar shows.

## 9. Per-deck review (Study CTA)

- [ ] Study launches a review session scoped to **that deck's** due cards
      (verify the request carries `?deckId=` and the queue matches the deck).
- [ ] Reveal → grade (Again/Hard/Good/Easy) → completion summary works.
- [ ] The global Review tab navigation and the existing global review flow are
      **unchanged**.

## 10. Ownership & errors

- [ ] On a **public deck owned by someone else**, attempting edit/archive/card
      write surfaces a server-side error via SnackBar (no client crash, no fake
      success).

## 11. Visual / responsive / a11y

- [ ] JA card front uses generous line-height (≥ 1.8); no clipping at 320 dp.
- [ ] All interactive controls ≥ 48 dp; visible focus rings; active-press
      feedback on buttons and card rows.
- [ ] Dark mode: card front/back, search field, sort toggle all readable
      (no dark-on-dark, error border visible on invalid fields).
- [ ] `prefers-reduced-motion` respected (no excessive animation).

## Deliverable

Per step: **PASS / FAIL / BLOCKED (reason)** with a screenshot reference and —
for any FAIL — exact file/line + reproduction steps. Summarize overall verdict
and whether deck/flashcard management is sign-off-ready pending documented
limitations.
