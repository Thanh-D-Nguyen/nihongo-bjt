# Feature: Flashcards

Flashcard + SRS vertical slice. **Phase 2: mock-backed, in-memory SRS state.**

Flow: deck list → review → reveal answer → grade (Again/Hard/Good/Easy) →
next card → completion. A real repository is swapped behind
`FlashcardRepository` in a later phase without touching the presentation layer.

Layout:

```
flashcards/
  domain/        # Flashcard, FlashcardDeck, SrsRating, FlashcardRepository
  data/          # MockFlashcardRepository (Phase 2 in-memory data)
  presentation/  # providers + deck-list / review screens
```
