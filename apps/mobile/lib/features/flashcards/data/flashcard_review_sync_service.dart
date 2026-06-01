import 'package:nihongo_bjt/features/flashcards/data/api_flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/data/offline_review_queue.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_repository.dart';

/// Outcome of a manual queue drain.
class ReviewSyncResult {
  const ReviewSyncResult({required this.synced, required this.failed});

  /// Rows submitted to the server successfully.
  final int synced;

  /// Rows that failed to submit and remain queued for a later attempt.
  final int failed;

  /// Total rows processed in this run.
  int get total => synced + failed;
}

/// Drains the offline review queue on demand (Phase 6B).
///
/// Manual only — there is no timer, polling, or background worker. Each pending
/// grade is resubmitted through the remote repository; on success the row is
/// marked synced, on failure its attempt count and last error are recorded and
/// it stays queued. Server-side idempotency is not yet enforced, so the locally
/// stored idempotency key is not transmitted (see IMPLEMENTATION_LOG Phase 6B).
///
/// The remote must be the bare API repository, never a cache wrapper that
/// itself enqueues on failure — otherwise a failed sync would double-enqueue.
class FlashcardReviewSyncService {
  FlashcardReviewSyncService(this._remote, this._queue);

  final FlashcardRepository _remote;
  final OfflineReviewQueue _queue;

  /// Submits every pending grade once. Returns counts of synced/failed rows.
  Future<ReviewSyncResult> sync() async {
    final pending = await _queue.pending();
    var synced = 0;
    var failed = 0;
    for (final item in pending) {
      try {
        await _remote.submitReviewRating(
          userFlashcardId: item.userFlashcardId,
          rating: item.rating,
        );
        await _queue.markSynced(item.id);
        synced++;
      } on FlashcardRepositoryException catch (error) {
        await _queue.markFailed(item.id, error.message);
        failed++;
      }
    }
    return ReviewSyncResult(synced: synced, failed: failed);
  }
}
