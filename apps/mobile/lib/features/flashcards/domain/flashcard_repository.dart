import 'package:nihongo_bjt/features/flashcards/domain/flashcard.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_deck.dart';
import 'package:nihongo_bjt/features/flashcards/domain/srs_rating.dart';

/// Read access to flashcard decks and their cards, plus SRS grade submission.
///
/// Phase 2 is served by an in-memory mock; a real (API/local-DB) implementation
/// is swapped behind this interface in a later phase without touching the
/// presentation layer.
abstract interface class FlashcardRepository {
  /// All decks available to the learner.
  Future<List<FlashcardDeck>> fetchDecks();

  /// Cards belonging to [deckId], in review order.
  Future<List<Flashcard>> fetchCards(String deckId);

  /// Submits an SRS [rating] for the learner's review row [userFlashcardId].
  ///
  /// [userFlashcardId] is the per-learner `userFlashcard.id`, not the card id.
  /// Implementations persist (or mock) the grade; the authenticated learner is
  /// resolved server-side from the bearer token.
  Future<void> submitReviewRating({
    required String userFlashcardId,
    required SrsRating rating,
  });
}
