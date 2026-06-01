import 'package:nihongo_bjt/features/flashcards/domain/srs_rating.dart';

/// A review grade persisted in the offline queue (Phase 6B).
///
/// Read model returned by the review-queue DAO; carries enough to resubmit the
/// grade during a manual sync and to surface failure diagnostics.
class QueuedReview {
  const QueuedReview({
    required this.id,
    required this.userFlashcardId,
    required this.rating,
    required this.answeredAt,
    required this.idempotencyKey,
    required this.status,
    required this.attemptCount,
    required this.createdAt,
    required this.updatedAt,
    this.lastError,
  });

  /// Local autoincrement id (queue row key).
  final int id;

  /// Per-learner review row id the grade applies to.
  final String userFlashcardId;

  /// SRS grade to submit.
  final SrsRating rating;

  /// When the learner graded the card (UTC).
  final DateTime answeredAt;

  /// Locally generated idempotency key (unique per logical event).
  final String idempotencyKey;

  /// `pending` (needs sync) or `synced`.
  final String status;

  /// Number of failed sync attempts so far.
  final int attemptCount;

  /// When this row was first enqueued (UTC).
  final DateTime createdAt;

  /// When this row was last updated (UTC).
  final DateTime updatedAt;

  /// Last sync error message; null until a sync attempt fails.
  final String? lastError;
}
