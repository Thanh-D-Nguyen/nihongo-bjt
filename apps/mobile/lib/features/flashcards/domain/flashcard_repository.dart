import 'package:nihongo_bjt/features/flashcards/domain/deck_card_input.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_detail.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_form_input.dart';
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

  /// Full detail (metadata + ordered cards) of a single [deckId].
  Future<DeckDetail> fetchDeckDetail(String deckId);

  /// Creates a new learner-owned deck from [input] and returns its server id.
  ///
  /// The authenticated learner is resolved server-side; [input] never carries a
  /// user id. Card content is not included — a new deck starts empty.
  Future<String> createDeck(DeckFormInput input);

  /// Creates a new learner-owned deck from [meta] together with its [cards] in
  /// a single request, returning the new deck's server id.
  ///
  /// Backs the one-step (Quizlet-like) Create Set flow: the backend
  /// `POST /api/flashcards/decks` accepts an optional `cards` array, so the deck
  /// and its cards are persisted at once. Cards are all new (no `cardId` /
  /// `deckCardId`). The learner is resolved server-side; [meta] never carries a
  /// user id.
  Future<String> createDeckWithCards(
    DeckFormInput meta,
    List<DeckCardInput> cards,
  );

  /// Updates the metadata of the learner-owned deck [deckId] from [input].
  ///
  /// Only metadata is sent (no `cards`), so the deck's card set is preserved.
  Future<void> updateDeckMeta(String deckId, DeckFormInput input);

  /// Replaces the entire card set of [deckId] with [cards].
  ///
  /// The server `PATCH` replaces a deck's whole card set whenever `cards` is
  /// present, so callers must pass the COMPLETE desired list (add / edit /
  /// delete are all expressed as the full set). The deck's [meta] is required
  /// because the update schema validates `titleVi` on every call.
  Future<void> saveDeckCards(
    String deckId,
    DeckFormInput meta,
    List<DeckCardInput> cards,
  );

  /// Archives (soft-removes) the learner-owned deck [deckId].
  ///
  /// Maps to the server's archive endpoint; owner-only, enforced server-side.
  Future<void> archiveDeck(String deckId);

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
