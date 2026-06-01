import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/database/app_database.dart';
import 'package:nihongo_bjt/features/flashcards/data/local/review_queue_dao.dart';
import 'package:nihongo_bjt/features/flashcards/data/offline_review_queue.dart';
import 'package:nihongo_bjt/features/flashcards/domain/srs_rating.dart';

void main() {
  late AppDatabase db;
  late ReviewQueueDao dao;

  setUp(() {
    db = AppDatabase.forTesting(NativeDatabase.memory());
    dao = ReviewQueueDao(db);
  });

  tearDown(() => db.close());

  OfflineReviewQueue buildQueue({
    String Function()? keyFactory,
    DateTime Function()? clock,
  }) => OfflineReviewQueue(
    dao,
    idempotencyKeyFactory: keyFactory,
    clock: clock,
  );

  test('enqueueFailedReview persists with injected key and clock', () async {
    final answeredAt = DateTime.utc(2026, 6, 1, 9, 30);
    final queue = buildQueue(
      keyFactory: () => 'fixed-key',
      clock: () => answeredAt,
    );

    final key = await queue.enqueueFailedReview(
      userFlashcardId: 'uf-1',
      rating: SrsRating.hard,
    );

    expect(key, 'fixed-key');
    final pending = await queue.pending();
    expect(pending, hasLength(1));
    expect(pending.single.userFlashcardId, 'uf-1');
    expect(pending.single.rating, SrsRating.hard);
    expect(pending.single.idempotencyKey, 'fixed-key');
    // Drift reads timestamps back in local time; compare the instant.
    expect(pending.single.answeredAt.isAtSameMomentAs(answeredAt), isTrue);
  });

  test('same idempotency key dedups to a single row', () async {
    final queue = buildQueue(keyFactory: () => 'dup');

    await queue.enqueueFailedReview(
      userFlashcardId: 'uf-1',
      rating: SrsRating.good,
    );
    await queue.enqueueFailedReview(
      userFlashcardId: 'uf-1',
      rating: SrsRating.good,
    );

    expect(await queue.pending(), hasLength(1));
  });

  test('default key factory produces unique 32-char hex keys', () async {
    final queue = buildQueue();

    final a = await queue.enqueueFailedReview(
      userFlashcardId: 'uf-1',
      rating: SrsRating.good,
    );
    final b = await queue.enqueueFailedReview(
      userFlashcardId: 'uf-2',
      rating: SrsRating.good,
    );

    expect(a, matches(RegExp(r'^[0-9a-f]{32}$')));
    expect(b, isNot(a));
    expect(await queue.pending(), hasLength(2));
  });

  test('markSynced and markFailed delegate to the DAO', () async {
    final queue = buildQueue(keyFactory: () => 'k');
    await queue.enqueueFailedReview(
      userFlashcardId: 'uf-1',
      rating: SrsRating.good,
    );
    final id = (await queue.pending()).single.id;

    await queue.markFailed(id, 'boom');
    final pending = await queue.pending();
    expect(pending.single.attemptCount, 1);
    expect(pending.single.lastError, 'boom');

    await queue.markSynced(id);
    expect(await queue.pending(), isEmpty);
  });
}
