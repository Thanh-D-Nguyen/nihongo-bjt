/// Visibility of a deck, mirroring the backend `deck.visibility` enum.
enum DeckVisibility {
  /// Only the owning learner can see the deck.
  private,

  /// Anyone can discover and study the deck.
  public;

  /// Parses the wire value, defaulting to [DeckVisibility.private] for unknown
  /// or missing values (the server's own default).
  static DeckVisibility fromWire(String? value) {
    return value == 'public' ? DeckVisibility.public : DeckVisibility.private;
  }

  /// Wire value sent back to the API (`private` | `public`).
  String get wire => name;
}

/// A named collection of flashcards the learner can review as one session.
class FlashcardDeck {
  const FlashcardDeck({
    required this.id,
    required this.title,
    required this.description,
    required this.cardCount,
    this.visibility = DeckVisibility.private,
  });

  final String id;

  /// Japanese deck title (e.g. `ビジネス基礎`).
  final String title;

  /// Short Vietnamese description of the deck's theme.
  final String description;

  /// Number of cards in the deck, used for the list summary.
  final int cardCount;

  /// Whether the deck is private to the learner or publicly shared.
  final DeckVisibility visibility;
}
