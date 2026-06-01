import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nihongo_bjt/core/database/app_database.dart';
import 'package:nihongo_bjt/features/flashcards/data/local/flashcard_cache_dao.dart';
import 'package:nihongo_bjt/features/flashcards/data/local/review_queue_dao.dart';

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
