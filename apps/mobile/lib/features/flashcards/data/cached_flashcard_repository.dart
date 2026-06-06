import 'package:nihongo_bjt/features/flashcards/data/api_flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/data/local/flashcard_cache_dao.dart';
import 'package:nihongo_bjt/features/flashcards/data/offline_review_queue.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_card_input.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_detail.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_form_input.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_deck.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/domain/srs_rating.dart';

/// Read-through cache wrapper around a remote [FlashcardRepository] (Phase 6A),
/// with offline review-queueing for failed submits (Phase 6B).
///
/// On a successful remote read the result is written to the local Drift cache.
/// If the remote read fails with a [FlashcardRepositoryException] (auth or
/// network), the last cached snapshot is returned when present; otherwise the
/// error is rethrown so the UI still shows a real failure instead of nothing.
///
/// On a failed grade submission the grade is enqueued for later manual sync and
/// the error is rethrown — never silently swallowed, never faked as success.
class CachedFlashcardRepository implements FlashcardRepository {
  CachedFlashcardRepository(this._remote, this._dao, this._queue);

  final FlashcardRepository _remote;
  final FlashcardCacheDao _dao;
  final OfflineReviewQueue _queue;

  @override
  Future<List<FlashcardDeck>> fetchDecks() async {
    try {
      final decks = await _remote.fetchDecks();
      await _dao.upsertDecks(decks);
      return decks;
    } on FlashcardRepositoryException {
      final cached = await _dao.readDecks();
      if (cached.isNotEmpty) return cached;
      rethrow;
    }
  }

  @override
  Future<DeckDetail> fetchDeckDetail(String deckId) async {
    // Deck detail is not yet locally cached (no detail cache table), so it is
    // served live. Failures surface as real errors — never faked.
    return _remote.fetchDeckDetail(deckId);
  }

  @override
  Future<String> createDeck(DeckFormInput input) {
    // Write-through: the deck-list cache is refreshed on the next fetchDecks
    // (the presentation layer invalidates the list provider after a mutation).
    return _remote.createDeck(input);
  }

  @override
  Future<String> createDeckWithCards(
    DeckFormInput meta,
    List<DeckCardInput> cards,
  ) {
    // Write-through (one-step create): the deck-list and detail caches are
    // refreshed when the presentation layer invalidates their providers after a
    // successful create.
    return _remote.createDeckWithCards(meta, cards);
  }

  @override
  Future<void> updateDeckMeta(String deckId, DeckFormInput input) {
    return _remote.updateDeckMeta(deckId, input);
  }

  @override
  Future<void> saveDeckCards(
    String deckId,
    DeckFormInput meta,
    List<DeckCardInput> cards,
  ) {
    // Write-through: the deck detail is served live and the presentation layer
    // invalidates the detail/list providers after a successful save.
    return _remote.saveDeckCards(deckId, meta, cards);
  }

  @override
  Future<void> archiveDeck(String deckId) {
    return _remote.archiveDeck(deckId);
  }

  @override
  Future<List<Flashcard>> fetchCards(String deckId) async {
    try {
      final cards = await _remote.fetchCards(deckId);
      await _dao.upsertReviewCards(deckId, cards);
      return cards;
    } on FlashcardRepositoryException {
      final cached = await _dao.readReviewCards(deckId);
      if (cached.isNotEmpty) return cached;
      rethrow;
    }
  }

  @override
  Future<void> submitReviewRating({
    required String userFlashcardId,
    required SrsRating rating,
  }) async {
    try {
      await _remote.submitReviewRating(
        userFlashcardId: userFlashcardId,
        rating: rating,
      );
    } on FlashcardRepositoryException {
      await _queue.enqueueFailedReview(
        userFlashcardId: userFlashcardId,
        rating: rating,
      );
      rethrow;
    }
  }
}
