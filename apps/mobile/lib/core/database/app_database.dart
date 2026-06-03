import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:nihongo_bjt/features/flashcards/data/local/flashcard_cache_dao.dart';
import 'package:nihongo_bjt/features/flashcards/data/local/flashcard_cache_tables.dart';
import 'package:nihongo_bjt/features/flashcards/data/local/review_queue_dao.dart';
import 'package:nihongo_bjt/features/progress/data/local/study_log_dao.dart';
import 'package:nihongo_bjt/features/progress/data/local/study_log_tables.dart';
import 'package:nihongo_bjt/features/settings/data/local/user_settings_dao.dart';
import 'package:nihongo_bjt/features/settings/data/local/user_settings_table.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

part 'app_database.g.dart';

/// On-device SQLite database (Drift) for the local flashcard cache (Phase 6A),
/// the offline review queue (Phase 6B) and device-scoped learner settings
/// (Phase 10.2).
///
/// Generated code (`app_database.g.dart`) is committed and never hand-edited.
@DriftDatabase(
  tables: [
    FlashcardDecks,
    FlashcardReviewCards,
    FlashcardReviewQueue,
    UserSettings,
    StudyEvents,
  ],
  daos: [FlashcardCacheDao, ReviewQueueDao, UserSettingsDao, StudyLogDao],
)
class AppDatabase extends _$AppDatabase {
  /// Opens the real on-device database (lazy file resolution).
  AppDatabase() : super(_openConnection());

  /// Builds a database over an injected executor (e.g. an in-memory engine in
  /// tests), so the cache can be verified without touching the filesystem.
  AppDatabase.forTesting(super.e);

  @override
  int get schemaVersion => 4;

  @override
  MigrationStrategy get migration => MigrationStrategy(
    onCreate: (m) => m.createAll(),
    onUpgrade: (m, from, to) async {
      // v2 (Phase 6B): introduce the offline review queue.
      if (from < 2) {
        await m.createTable(flashcardReviewQueue);
      }
      // v3 (Phase 10.2): introduce the device-scoped settings store.
      if (from < 3) {
        await m.createTable(userSettings);
      }
      // v4 (Phase 02 Progress): introduce the on-device study log.
      if (from < 4) {
        await m.createTable(studyEvents);
      }
    },
  );
}

QueryExecutor _openConnection() {
  return LazyDatabase(() async {
    final dir = await getApplicationDocumentsDirectory();
    final file = File(p.join(dir.path, 'nihongo_bjt_cache.sqlite'));
    return NativeDatabase.createInBackground(file);
  });
}
