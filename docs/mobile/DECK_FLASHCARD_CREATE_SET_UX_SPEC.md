# Create Set — Mobile UX Spec

Quizlet-like one-step Create Set for `apps/mobile`. Screen:
`flashcard_create_set_page.dart`. Route: `flashcardCreate`
(`/review/flashcards/new`, under the Review shell branch).

## Goal

Let a learner create a deck **and** its cards in one fast, focused, mobile-native
flow that persists via a single `POST /api/flashcards/decks` (with `cards[]`).
It must feel like a flashcard-set creator, not a basic CRUD form.

## Layout (top → bottom, single scroll view)

1. **App bar** — title `cardSetCreateTitle`. Leading back triggers the unsaved
   guard. Trailing **Import** icon button opens the import sheet.
2. **Metadata section** (collapsible "details", expanded by default on create):
   - `titleVi` — required, max 120, autofocus.
   - `titleJa` — optional, max 120.
   - `descriptionVi` — optional, max 500, 2–4 lines.
   - Visibility segmented control (private | public), default private.
   - `titleJa`/`descriptionJa` live under a "More details" disclosure to keep
     the first screen short and fast.
3. **Cards section**:
   - Section header `cardSetCardsHeader` + live count `n/200`.
   - **Reading toggle** (show/hide the optional kana field on every row).
   - A list of `DeckCardEditorRow` blocks (front, back, optional reading),
     numbered, each with a remove affordance (disabled when only one row left).
   - **Add card** outlined button (full-width, 48dp) — disabled at 200 rows.
   - **Import from text** secondary entry (also in the app bar).
4. **Sticky bottom bar** (above the keyboard, never covering fields):
   - Primary **Create set** button with `isLoading`.
   - Helper validation summary line when there are blocking errors
     (`cardSetValidationSummary(count)`).

## Behavior

- **Initial state**: 1 metadata block expanded + 3 empty card rows (matches the
  bulk-add starting point; fast to fill).
- **Auto-grow**: when the learner types into the last row's front or back, an
  empty row is appended automatically (cap 200). Manual **Add card** still works.
- **Per-row validation** (on submit, mirrors backend Zod):
  - front required, ≤500; back required, ≤2000; reading optional, ≤300.
  - Empty trailing rows are ignored (not validated, not sent).
- **Submit rules**:
  - `titleVi` required → inline error if blank.
  - At least one non-empty card required → summary error if none.
  - On any row error → show inline errors + summary, do not submit, scroll to
    first error.
- **Save flow** (`DeckMutationController.createWithCards`):
  - loading → disable inputs + spinner on CTA.
  - success → snackbar `cardSetCreateSuccess`, invalidate deck list, then
    `pushReplacementNamed(flashcardDeck, {deckId})` (open the new deck detail,
    matching the web "stay and inspect" default; review is one tap away).
  - error → snackbar with the repository's real message; form stays, inputs
    re-enabled, no data lost.
- **Unsaved-changes guard** (`PopScope`): if `titleVi` or any card row has
  content and the save has not succeeded, intercept back/leave and show a
  confirm dialog (`cardSetDiscardTitle` / `cardSetDiscardMessage` / Discard ·
  Keep editing). Clean (untouched) form pops freely.

## Keyboard safety

- Single scroll view with `resizeToAvoidBottomInset`; bottom CTA sits in a
  `SafeArea` sticky container that floats above the keyboard.
- `TextInputAction.next` chains front → (reading) → back; the last back field
  uses `newline`.
- No horizontal overflow at 320–390 dp; rows wrap vertically, never side-by-side.

## States

- **Empty/initial**: 3 prompt rows with hint text; CTA enabled but blocks on
  validation.
- **Saving**: CTA spinner, inputs disabled.
- **Error**: snackbar + preserved input.
- **Success**: navigate to deck detail.

## Accessibility & polish

- 48dp touch targets; `active:scale` feedback on buttons; focus rings via theme.
- JA fields line-height ≥1.8; VI ≥1.5.
- Dark mode via palette tokens only. `prefers-reduced-motion` respected (≤300ms,
  ≤3 concurrent animations).

## Out of scope (deferred)

- Per-card image upload, reading auto-fill, reorder/drag (rows are add/remove +
  import-ordered for this pass). Documented in `MOBILE_KNOWN_LIMITATIONS.md`.
