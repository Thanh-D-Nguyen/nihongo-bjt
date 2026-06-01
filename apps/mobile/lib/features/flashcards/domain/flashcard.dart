/// A single study item: a Japanese prompt with its reading and Vietnamese
/// meaning. The meaning ([back]) is hidden until the learner reveals it.
class Flashcard {
  const Flashcard({
    required this.id,
    required this.userFlashcardId,
    required this.front,
    required this.reading,
    required this.back,
  });

  /// Stable card identity used for display and in-session grade keys.
  final String id;

  /// Per-learner review row id (`userFlashcard.id`) required to submit an SRS
  /// grade to `POST /api/flashcards/reviews/{userFlashcardId}`.
  final String userFlashcardId;

  /// Japanese headword shown first (e.g. `会議`).
  final String front;

  /// Kana reading of [front] (e.g. `かいぎ`).
  final String reading;

  /// Vietnamese meaning, revealed after the learner answers.
  final String back;
}
