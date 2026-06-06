# Deck / Flashcard Mobile — Retest Checklist

Tick-box companion to `DECK_FLASHCARD_RETEST_PROMPT_FOR_CODEX.md`. Run at
360–390 dp, light + dark, locales vi + ja, against the real API.

## Pre-flight
- [ ] `flutter analyze` → No issues found
- [ ] `flutter test test/features/flashcards` → all green
- [ ] Logged in at runtime (no committed credentials)

## Create Set (one-step)
- [ ] Deck-list **+ FAB** opens Create Set (not metadata-only form)
- [ ] Empty-state CTA opens Create Set
- [ ] Shows title (autofocus), description, visibility, More-details disclosure
- [ ] Starts with 3 empty card rows + reading toggle + Add card + Import
- [ ] Auto-grow: typing last row appends a new row; caps at 200
- [ ] Empty submit → title required + "add a card" + blocking summary + scrolls to first error
- [ ] Valid submit → success snackbar (card count) → replaces into deck detail
- [ ] Cards persist across sessions/devices (server-authoritative)
- [ ] Back with unsaved input → discard confirmation (Keep editing / Discard)

## Import / paste (Create Set + Add cards)
- [ ] Tab / pipe / comma / " - " separators all parse
- [ ] Single-line `;` splits into rows
- [ ] Reading-column toggle maps 3rd column to reading
- [ ] Preview counts valid vs error; flags missing front/back + over-length
- [ ] Over-200 warning + truncation
- [ ] Append vs Replace behave correctly; both disabled at 0 valid rows

## Add cards to existing deck (refactored)
- [ ] Rows identical to Create Set (shared editor); reading toggle + import present
- [ ] Save appends new cards, preserves existing cards + SRS rows
- [ ] Success snackbar + back

## Edit / delete
- [ ] Deck edit updates metadata only ("Save changes")
- [ ] Single card edit updates one card; delete removes it

## Review / SRS (no regression)
- [ ] Review session reveal unchanged; grades persist; SRS scheduling works
- [ ] No bottom-nav conflict in focused review

## Quality bar
- [ ] Touch targets ≥ 48 dp; transitions + active states; focus rings
- [ ] No double borders; consistent radius/spacing
- [ ] JA line-height ≥ 1.8; VI ≥ 1.5
- [ ] Loading shimmer / empty / error+retry states present
- [ ] Dark mode parity; no overflow at 360–390 dp
- [ ] All copy from l10n (vi + ja); no raw strings
