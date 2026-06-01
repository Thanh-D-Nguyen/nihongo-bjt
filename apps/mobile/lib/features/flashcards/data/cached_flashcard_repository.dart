import 'package:nihongo_bjt/features/flashcards/data/api_flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/data/local/flashcard_cache_dao.dart';
import 'package:nihongo_bjt/features/flashcards/data/offline_review_queue.dart';
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
