# Deck / Flashcard Mobile — Retest Prompt for Codex

Use this prompt to validate the upgraded **Deck & Flashcard management** flow on
the Nihongo BJT Flutter mobile app (`apps/mobile`). The work converts the old
two-step "create deck, then add cards" into a **Quizlet-like one-step Create
Set** experience, adds a **paste/import** path, and refactors the multi-card
"add to existing deck" screen to reuse the same editor rows.

> Do **not** modify production code unless a defect is found and you are
> explicitly asked to fix it. Log in only at runtime — never hardcode or commit
> credentials.

---

## Environment

- App: `apps/mobile` (Flutter + Riverpod + go_router + drift).
- Backend must be reachable (real API). Server resolves the learner from the
  bearer token; the client never sends `userId`.
- Run on a phone/emulator at **360–390 dp** widths. Verify **light and dark**.
- Locales: **vi** (default) and **ja**. All copy must come from l10n (no raw
  strings).

Start commands (from repo root, infra already running in WSL):

```bash
cd apps/mobile
flutter analyze            # expect: No issues found
flutter test test/features/flashcards   # expect: all green
flutter run                # launch on device/emulator
```

---

## Routes under test (Review tab → `/review/flashcards/...`)

| Route name | Path | Screen |
| --- | --- | --- |
| `flashcardCreate` | `new` | **FlashcardCreateSetPage** (one-step create) |
| `flashcardDeck` | `:deckId` | Deck detail |
| `flashcardEdit` | `:deckId/edit` | Deck metadata edit (edit-only) |
| `flashcardCardCreate` | `:deckId/cards/new` | Bulk add cards to existing deck |
| `flashcardCardEdit` | `:deckId/cards/:cardIndex/edit` | Single card edit |

---

## Test checklist

### 1. Create Set (one-step) — primary target
1. From the **deck list**, tap the **+ FAB** (and separately the empty-state
   CTA). Both must open **Create Set**, not a metadata-only form.
2. Confirm the page shows: Vietnamese title (autofocused), description,
   visibility selector (Private/Public, 48 dp segments), a **More details**
   disclosure (Japanese title + description), a **cards** section with **3 empty
   rows**, a reading toggle, **Add card**, and **Import from text**.
3. **Auto-grow**: type into the last row's front field → a new empty row
   appends. Confirm it stops at **200** cards.
4. **Validation**: tap **Create** with everything empty → Vietnamese title shows
   "required", the cards section shows "add at least one card", and the bottom
   bar shows the blocking-count summary. The screen scrolls to the first error.
5. Fill the title + at least one card (front + back), toggle **reading** on and
   add a reading. Tap **Create** → success snackbar with the saved card count,
   then navigation **replaces** into the new **deck detail** showing the cards.
6. Reopen the deck on another device/session → the deck and cards persist
   (server-authoritative; nothing is local-only).
7. **Unsaved guard**: enter a title, then press back → a discard confirmation
   appears. "Keep editing" stays; "Discard" leaves.

### 2. Import / paste
1. In Create Set (and again in **Add cards** on an existing deck), tap
   **Import from text**.
2. Paste tab-separated rows (`term⇥meaning`), then pipe-separated, then
   comma-separated, then `term - meaning`. Each must parse into preview rows.
3. Single-line input separated by `;` must split into multiple rows.
4. Toggle **reading column** on and paste a third column → it maps to reading.
5. Confirm the live **preview** counts valid vs error rows, flags missing
   front/back and over-length fields, and warns when over **200** (truncates).
6. **Append** adds to existing rows; **Replace** swaps them. Both disabled when
   there are 0 valid rows.

### 3. Add cards to an existing deck (refactored)
1. Open a deck → **Add cards**. The rows must look/behave identically to Create
   Set (shared editor). Reading toggle + Import button present.
2. Add several cards and save → existing cards are preserved (the server keeps
   shared cards and SRS rows), new cards appended. Success snackbar + back.

### 4. Edit / delete
1. Deck **edit** updates metadata only (title/description/visibility); the CTA
   reads "Save changes".
2. Single **card edit** updates one card; delete removes it.

### 5. Review / SRS (no regression)
1. Start a review session from a deck. Reveal behavior unchanged; grades persist
   and SRS scheduling continues to work. Focused review has no bottom-nav
   conflict.

### 6. Quality bar (every screen)
- Touch targets ≥ 48 dp; transitions/active states on interactive elements;
  focus rings; no double borders; consistent radius/spacing.
- Japanese text line-height ≥ 1.8, Vietnamese ≥ 1.5.
- Loading shimmer, encouraging empty state, gentle error state with retry.
- Dark mode parity; no overflow at 360–390 dp.

---

## Evidence to capture
- Screenshots: Create Set (light + dark), validation state, import preview,
  success → deck detail, Add cards screen, review session.
- Console output of `flutter analyze` and `flutter test test/features/flashcards`.
- Any defects with route, repro steps, and expected vs actual.

See `DECK_FLASHCARD_RETEST_CHECKLIST.md` for a tick-box version of the above.
Known deferred items are in `DECK_FLASHCARD_MOBILE_IMPLEMENTATION_PLAN.md`.
