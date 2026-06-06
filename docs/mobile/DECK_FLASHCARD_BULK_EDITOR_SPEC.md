# Bulk Import (Paste) — Mobile Spec

Paste-based card import for the Create Set and Add-cards flows. UI:
`presentation/widgets/deck_card_import_sheet.dart`. Parser:
`domain/deck_card_import.dart` (pure, unit-tested).

## Goal

Let a learner paste many term/definition pairs and turn them into editable card
rows, with a preview and row-level errors, before anything is saved. No
auto-save, no silent dropping of invalid rows, no fake AI/file import.

## Parser contract (`parseDeckCardImport`)

Input: raw multi-line text + chosen separators. Output: an ordered list of
parsed rows, each either valid (front/back[/reading]) or carrying a row error.

### Row separator
- Newline (`\n`). Each non-blank line is one card. Blank lines are skipped
  (not errors).
- Optional: semicolon (`;`) as an alternate row separator when the text has no
  newlines (single-line paste). Newline takes precedence when both exist.

### Term/definition separator (per row), tried in order
1. **Tab** (`\t`) — matches web's primary format.
2. **Pipe** (`|`) — matches web's fallback.
3. **Comma** (`,`).
4. **Dash** surrounded by spaces (` - `).

The first separator present in the row is used. The row splits into at most 3
fields: `front`, `back`, optional `reading` (third field). Extra separators
beyond the third field are folded back into `back` so definitions containing the
separator are not truncated incorrectly when only 2 fields are expected — the
parser splits on the **first** occurrence for front, then the next for reading
only when a reading column is enabled.

> Default mapping is two-column: `front <sep> back`. A third column is treated
> as `reading` only when the import sheet's "has reading column" option is on.

### Row-level validation (mirrors backend Zod)
- Missing front → error `importRowMissingFront`.
- Missing back → error `importRowMissingBack`.
- front >500 / back >2000 / reading >300 → too-long error.
- Total rows capped at 200; rows beyond 200 → error `importTooManyRows`.

Invalid rows are **kept and shown with their error**, never discarded silently.

## Import sheet UX

1. **Paste field** — large multiline text area, monospace-ish, hint with a
   format example (`term  ⇥  definition` and `term | definition`).
2. **Options** — separator hint is automatic; a single toggle "third column is
   reading" (off by default).
3. **Preview** — live parsed list: each row shows term / definition (/ reading),
   valid rows in normal style, invalid rows with an inline error chip. A summary
   line shows `n valid · m errors`.
4. **Actions**:
   - **Replace** — replace the current editor rows with the parsed valid rows.
   - **Append** — append parsed valid rows to the existing editor rows (respects
     the 200 cap; overflow blocked with a message).
   - **Cancel** — dismiss, no changes.
   - Replace/Append are disabled while there are zero valid rows.
5. After Replace/Append the parsed rows become normal editable
   `DeckCardEditorRow`s — the learner can fix anything before the final save.

## Rules (hard)

- Preview before any write to the editor. No direct save from the import sheet.
- Never discard invalid rows; surface them so the learner can fix the source.
- No file picker, no AI generation, no network calls in the parser.
- Parser is pure and deterministic → fully unit-tested independent of UI.

## Tests

- Parser: tab, pipe, comma, dash; newline vs semicolon rows; blank-line skip;
  missing front/back; too-long; >200 cap; reading column on/off; definition
  containing a comma.
- Sheet widget: paste → preview counts; Replace vs Append; disabled when no
  valid rows; 200-cap overflow on append.
