import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/database/app_database.dart';
import 'package:nihongo_bjt/features/flashcards/domain/srs_rating.dart';
import 'package:nihongo_bjt/features/progress/data/local/study_log_dao.dart';

void main() {
  late AppDatabase db;
  late StudyLogDao dao;

  setUp(() {
    db = AppDatabase.forTesting(NativeDatabase.memory());
    dao = db.studyLogDao;
  });

  tearDown(() => db.close());

  test('records reviews and reads them back within a window', () async {
    final now = DateTime.now().toUtc();
    await dao.recordFlashcardReview(rating: SrsRating.good, occurredAt: now);
    await dao.recordFlashcardReview(
      rating: SrsRating.again,
      occurredAt: now.subtract(const Duration(days: 1)),
    );
    await dao.recordFlashcardReview(
      rating: SrsRating.easy,
      occurredAt: now.subtract(const Duration(days: 30)),
    );

    expect(await dao.totalCount(), 3);

    final recent = await dao.eventsSince(now.subtract(const Duration(days: 7)));
    expect(recent, hasLength(2));
    expect(recent.first.occurredAt.isBefore(recent.last.occurredAt), isTrue);
    expect(recent.last.rating, SrsRating.good.name);
  });

  test('totalCount is zero on a fresh database', () async {
    expect(await dao.totalCount(), 0);
    expect(await dao.eventsSince(DateTime.utc(2000)), isEmpty);
  });
}
