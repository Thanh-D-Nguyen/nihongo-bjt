import 'dart:math';

import 'package:nihongo_bjt/features/flashcards/data/local/queued_review.dart';
import 'package:nihongo_bjt/features/flashcards/data/local/review_queue_dao.dart';
import 'package:nihongo_bjt/features/flashcards/domain/srs_rating.dart';

/// Local offline queue for review grades that could not be submitted online
/// (Phase 6B).
///
/// Thin domain-facing layer over [ReviewQueueDao]: it owns idempotency-key
/// generation and the clock so callers (and tests) stay decoupled from Drift.
/// There is no background worker — draining is driven by a sync service.
class OfflineReviewQueue {
  OfflineReviewQueue(
    this._dao, {
    String Function()? idempotencyKeyFactory,
    DateTime Function()? clock,
  }) : _newKey = idempotencyKeyFactory ?? _defaultIdempotencyKey,
       _now = clock ?? DateTime.now;

  final ReviewQueueDao _dao;
  final String Function() _newKey;
  final DateTime Function() _now;

  /// Persists a review [rating] for [userFlashcardId] that failed to submit,
  /// for later manual sync. Returns the assigned idempotency key.
  Future<String> enqueueFailedReview({
    required String userFlashcardId,
    required SrsRating rating,
  }) async {
    final key = _newKey();
    await _dao.enqueueReview(
      userFlashcardId: userFlashcardId,
      rating: rating,
      answeredAt: _now().toUtc(),
      idempotencyKey: key,
    );
    return key;
  }

  /// Pending grades awaiting sync, in FIFO order.
  Future<List<QueuedReview>> pending() => _dao.readPendingReviews();

  /// Marks queue row [id] as synced.
  Future<void> markSynced(int id) => _dao.markSynced(id);

  /// Records a failed sync attempt for queue row [id].
  Future<void> markFailed(int id, String error) => _dao.markFailed(id, error);
}

/// Generates a random 128-bit hex idempotency key without external packages.
String _defaultIdempotencyKey() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  return bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
}
