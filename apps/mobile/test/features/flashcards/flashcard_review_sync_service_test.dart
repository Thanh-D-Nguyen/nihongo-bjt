import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/database/app_database.dart';
import 'package:nihongo_bjt/features/flashcards/data/api_flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/data/flashcard_review_sync_service.dart';
import 'package:nihongo_bjt/features/flashcards/data/local/review_queue_dao.dart';
import 'package:nihongo_bjt/features/flashcards/data/offline_review_queue.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_deck.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/domain/srs_rating.dart';

/// Records submissions and can be toggled to fail, simulating offline.
class _FakeRemote implements FlashcardRepository {
  bool fail = false;
  final List<(String, SrsRating)> submissions = [];

  @override
  Future<List<FlashcardDeck>> fetchDecks() async => const [];

  @override
  Future<List<Flashcard>> fetchCards(String deckId) async => const [];

  @override
  Future<void> submitReviewRating({
    required String userFlashcardId,
    required SrsRating rating,
  }) async {
    if (fail) throw const FlashcardRepositoryException('offline');
    submissions.add((userFlashcardId, rating));
  }
}

void main() {
  late AppDatabase db;
  late OfflineReviewQueue queue;
  late _FakeRemote remote;
  late FlashcardReviewSyncService service;
  var keySeq = 0;

  setUp(() {
    db = AppDatabase.forTesting(NativeDatabase.memory());
    keySeq = 0;
    queue = OfflineReviewQueue(
      ReviewQueueDao(db),
      idempotencyKeyFactory: () => 'key-${keySeq++}',
    );
    remote = _FakeRemote();
    service = FlashcardReviewSyncService(remote, queue);
  });

  tearDown(() => db.close());

  Future<void> seed(String userFlashcardId, SrsRating rating) =>
      queue.enqueueFailedReview(
        userFlashcardId: userFlashcardId,
        rating: rating,
      );

  test('drains all pending rows on a successful sync', () async {
    await seed('uf-1', SrsRating.good);
    await seed('uf-2', SrsRating.hard);

    final result = await service.sync();

    expect(result.synced, 2);
    expect(result.failed, 0);
    expect(result.total, 2);
    expect(remote.submissions, [
      ('uf-1', SrsRating.good),
      ('uf-2', SrsRating.hard),
    ]);
    expect(await queue.pending(), isEmpty);
  });

  test('failed submits stay queued with bumped attempt count', () async {
    await seed('uf-1', SrsRating.good);
    remote.fail = true;

    final result = await service.sync();

    expect(result.synced, 0);
    expect(result.failed, 1);
    final pending = await queue.pending();
    expect(pending, hasLength(1));
    expect(pending.single.attemptCount, 1);
    expect(pending.single.lastError, 'offline');
  });

  test('a previously failed row syncs on a later run', () async {
    await seed('uf-1', SrsRating.good);
    remote.fail = true;
    await service.sync();

    remote.fail = false;
    final result = await service.sync();

    expect(result.synced, 1);
    expect(await queue.pending(), isEmpty);
  });

  test('sync with an empty queue is a no-op', () async {
    final result = await service.sync();

    expect(result.total, 0);
    expect(remote.submissions, isEmpty);
  });
}
