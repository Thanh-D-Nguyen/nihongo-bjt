/// A named collection of flashcards the learner can review as one session.
class FlashcardDeck {
  const FlashcardDeck({
    required this.id,
    required this.title,
    required this.description,
    required this.cardCount,
  });

  final String id;

  /// Japanese deck title (e.g. `ビジネス基礎`).
  final String title;

  /// Short Vietnamese description of the deck's theme.
  final String description;

  /// Number of cards in the deck, used for the list summary.
  final int cardCount;
}
