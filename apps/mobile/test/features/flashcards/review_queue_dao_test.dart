import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/database/app_database.dart';
import 'package:nihongo_bjt/features/flashcards/data/local/review_queue_dao.dart';
import 'package:nihongo_bjt/features/flashcards/domain/srs_rating.dart';

void main() {
  late AppDatabase db;
  late ReviewQueueDao dao;

  setUp(() {
    db = AppDatabase.forTesting(NativeDatabase.memory());
    dao = ReviewQueueDao(db);
  });

  tearDown(() => db.close());

  Future<void> enqueue(
    String userFlashcardId,
    SrsRating rating,
    String key,
  ) => dao.enqueueReview(
    userFlashcardId: userFlashcardId,
    rating: rating,
    answeredAt: DateTime.utc(2026, 6, 1, 9),
    idempotencyKey: key,
  );

  test('enqueue then read round-trips a pending review', () async {
    await enqueue('uf-1', SrsRating.good, 'key-1');

    final pending = await dao.readPendingReviews();

    expect(pending, hasLength(1));
    final row = pending.single;
    expect(row.userFlashcardId, 'uf-1');
    expect(row.rating, SrsRating.good);
    expect(row.status, ReviewQueueDao.statusPending);
    expect(row.attemptCount, 0);
    expect(row.lastError, isNull);
  });

  test('pending reviews come back in FIFO (enqueue) order', () async {
    await enqueue('uf-1', SrsRating.again, 'key-1');
    await enqueue('uf-2', SrsRating.hard, 'key-2');
    await enqueue('uf-3', SrsRating.easy, 'key-3');

    final ids = (await dao.readPendingReviews())
        .map((r) => r.userFlashcardId)
        .toList();

    expect(ids, ['uf-1', 'uf-2', 'uf-3']);
  });

  test('duplicate idempotency key is ignored (no second row)', () async {
    await enqueue('uf-1', SrsRating.good, 'dup');
    await enqueue('uf-1', SrsRating.good, 'dup');

    expect(await dao.readPendingReviews(), hasLength(1));
  });

  test('markSynced removes the row from the pending set', () async {
    await enqueue('uf-1', SrsRating.good, 'key-1');
    final id = (await dao.readPendingReviews()).single.id;

    await dao.markSynced(id);

    expect(await dao.readPendingReviews(), isEmpty);
  });

  test('markFailed bumps attempt count, stores error, stays pending', () async {
    await enqueue('uf-1', SrsRating.good, 'key-1');
    final id = (await dao.readPendingReviews()).single.id;

    await dao.markFailed(id, 'offline');
    await dao.markFailed(id, 'offline again');

    final pending = await dao.readPendingReviews();
    expect(pending, hasLength(1));
    expect(pending.single.attemptCount, 2);
    expect(pending.single.lastError, 'offline again');
    expect(pending.single.status, ReviewQueueDao.statusPending);
  });

  test('markFailed on a missing row is a no-op', () async {
    await dao.markFailed(999, 'nope');

    expect(await dao.readPendingReviews(), isEmpty);
  });
}
