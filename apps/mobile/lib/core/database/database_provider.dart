import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nihongo_bjt/core/database/app_database.dart';
import 'package:nihongo_bjt/features/flashcards/data/local/flashcard_cache_dao.dart';
import 'package:nihongo_bjt/features/flashcards/data/local/review_queue_dao.dart';
import 'package:nihongo_bjt/features/progress/data/local/study_log_dao.dart';
import 'package:nihongo_bjt/features/settings/data/local/user_settings_dao.dart';

/// Owns the single on-device [AppDatabase] instance and closes it on dispose.
final appDatabaseProvider = Provider<AppDatabase>((ref) {
  final database = AppDatabase();
  ref.onDispose(database.close);
  return database;
});

/// Exposes the flashcard cache DAO backed by [appDatabaseProvider].
final flashcardCacheDaoProvider = Provider<FlashcardCacheDao>((ref) {
  return ref.watch(appDatabaseProvider).flashcardCacheDao;
});

/// Exposes the offline review-queue DAO backed by [appDatabaseProvider].
final reviewQueueDaoProvider = Provider<ReviewQueueDao>((ref) {
  return ref.watch(appDatabaseProvider).reviewQueueDao;
});

/// Exposes the device-scoped settings DAO backed by [appDatabaseProvider].
final userSettingsDaoProvider = Provider<UserSettingsDao>((ref) {
  return ref.watch(appDatabaseProvider).userSettingsDao;
});

/// Exposes the on-device study-log DAO backed by [appDatabaseProvider].
final studyLogDaoProvider = Provider<StudyLogDao>((ref) {
  return ref.watch(appDatabaseProvider).studyLogDao;
});
