// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'review_queue_dao.dart';

// ignore_for_file: type=lint
mixin _$ReviewQueueDaoMixin on DatabaseAccessor<AppDatabase> {
  $FlashcardReviewQueueTable get flashcardReviewQueue =>
      attachedDatabase.flashcardReviewQueue;
  ReviewQueueDaoManager get managers => ReviewQueueDaoManager(this);
}

class ReviewQueueDaoManager {
  final _$ReviewQueueDaoMixin _db;
  ReviewQueueDaoManager(this._db);
  $$FlashcardReviewQueueTableTableManager get flashcardReviewQueue =>
      $$FlashcardReviewQueueTableTableManager(
        _db.attachedDatabase,
        _db.flashcardReviewQueue,
      );
}
