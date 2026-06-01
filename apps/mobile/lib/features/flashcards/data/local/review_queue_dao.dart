import 'package:drift/drift.dart';
import 'package:nihongo_bjt/core/database/app_database.dart';
import 'package:nihongo_bjt/features/flashcards/data/local/flashcard_cache_tables.dart';
import 'package:nihongo_bjt/features/flashcards/data/local/queued_review.dart';
import 'package:nihongo_bjt/features/flashcards/domain/srs_rating.dart';

part 'review_queue_dao.g.dart';

/// Data-access object for the offline review queue (Phase 6B).
///
/// Backs failed-submit persistence and manual sync. There is no background
/// worker, timer, or give-up policy here — failed rows stay `pending` so the
/// next manual sync retries them, while [QueuedReview.attemptCount] and
/// [QueuedReview.lastError] capture diagnostics.
@DriftAccessor(tables: [FlashcardReviewQueue])
class ReviewQueueDao extends DatabaseAccessor<AppDatabase>
    with _$ReviewQueueDaoMixin {
  ReviewQueueDao(super.attachedDatabase);

  static const String statusPending = 'pending';
  static const String statusSynced = 'synced';

  /// Enqueues a failed review grade. Duplicate [idempotencyKey]s are ignored,
  /// so re-enqueuing the same logical event never creates a second row.
  Future<void> enqueueReview({
    required String userFlashcardId,
    required SrsRating rating,
    required DateTime answeredAt,
    required String idempotencyKey,
  }) async {
    final now = DateTime.now().toUtc();
    await into(flashcardReviewQueue).insert(
      FlashcardReviewQueueCompanion.insert(
        userFlashcardId: userFlashcardId,
        rating: rating.name,
        answeredAt: answeredAt,
        idempotencyKey: idempotencyKey,
        createdAt: now,
        updatedAt: now,
      ),
      mode: InsertMode.insertOrIgnore,
    );
  }

  /// Reads the pending queue in FIFO (enqueue) order.
  Future<List<QueuedReview>> readPendingReviews() async {
    final query = select(flashcardReviewQueue)
      ..where((row) => row.status.equals(statusPending))
      ..orderBy([(row) => OrderingTerm.asc(row.createdAt)]);
    final rows = await query.get();
    return rows.map(_toDomain).toList();
  }

  /// Marks the row [id] as successfully synced.
  Future<void> markSynced(int id) async {
    await (update(
      flashcardReviewQueue,
    )..where((row) => row.id.equals(id))).write(
      FlashcardReviewQueueCompanion(
        status: const Value(statusSynced),
        updatedAt: Value(DateTime.now().toUtc()),
      ),
    );
  }

  /// Records a failed sync attempt: increments the attempt count and stores
  /// [error]. The row stays `pending` so a later manual sync retries it.
  Future<void> markFailed(int id, String error) async {
    final row = await (select(
      flashcardReviewQueue,
    )..where((row) => row.id.equals(id))).getSingleOrNull();
    if (row == null) return;
    await (update(flashcardReviewQueue)..where((r) => r.id.equals(id))).write(
      FlashcardReviewQueueCompanion(
        attemptCount: Value(row.attemptCount + 1),
        lastError: Value(error),
        updatedAt: Value(DateTime.now().toUtc()),
      ),
    );
  }

  QueuedReview _toDomain(FlashcardReviewQueueRow row) => QueuedReview(
    id: row.id,
    userFlashcardId: row.userFlashcardId,
    rating: SrsRating.values.byName(row.rating),
    answeredAt: row.answeredAt,
    idempotencyKey: row.idempotencyKey,
    status: row.status,
    attemptCount: row.attemptCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastError: row.lastError,
  );
}
