import 'package:drift/drift.dart';
import 'package:nihongo_bjt/core/database/app_database.dart';
import 'package:nihongo_bjt/features/flashcards/domain/srs_rating.dart';
import 'package:nihongo_bjt/features/progress/data/local/study_log_tables.dart';

part 'study_log_dao.g.dart';

/// Data-access object for the on-device study log (Phase 02 Progress).
///
/// Append-only: every graded review records one row. Reads expose the raw
/// events in a bounded window so the Progress provider can derive counts,
/// per-day activity and a study-day streak. No SRS scheduling lives here.
@DriftAccessor(tables: [StudyEvents])
class StudyLogDao extends DatabaseAccessor<AppDatabase>
    with _$StudyLogDaoMixin {
  StudyLogDao(super.attachedDatabase);

  /// Event kind for a graded flashcard review.
  static const String kindFlashcardReview = 'flashcard_review';

  /// Records a graded flashcard review at [occurredAt] (UTC).
  Future<void> recordFlashcardReview({
    required SrsRating rating,
    required DateTime occurredAt,
  }) async {
    await into(studyEvents).insert(
      StudyEventsCompanion.insert(
        kind: kindFlashcardReview,
        rating: Value(rating.name),
        occurredAt: occurredAt.toUtc(),
      ),
    );
  }

  /// Reads every event at or after [since] (UTC), oldest first.
  Future<List<StudyEventRow>> eventsSince(DateTime since) async {
    final query = select(studyEvents)
      ..where((row) => row.occurredAt.isBiggerOrEqualValue(since.toUtc()))
      ..orderBy([(row) => OrderingTerm.asc(row.occurredAt)]);
    return query.get();
  }

  /// Total number of recorded study events.
  Future<int> totalCount() async {
    final count = studyEvents.id.count();
    final query = selectOnly(studyEvents)..addColumns([count]);
    final row = await query.getSingle();
    return row.read(count) ?? 0;
  }
}
