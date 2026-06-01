// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'flashcard_cache_dao.dart';

// ignore_for_file: type=lint
mixin _$FlashcardCacheDaoMixin on DatabaseAccessor<AppDatabase> {
  $FlashcardDecksTable get flashcardDecks => attachedDatabase.flashcardDecks;
  $FlashcardReviewCardsTable get flashcardReviewCards =>
      attachedDatabase.flashcardReviewCards;
  FlashcardCacheDaoManager get managers => FlashcardCacheDaoManager(this);
}

class FlashcardCacheDaoManager {
  final _$FlashcardCacheDaoMixin _db;
  FlashcardCacheDaoManager(this._db);
  $$FlashcardDecksTableTableManager get flashcardDecks =>
      $$FlashcardDecksTableTableManager(
        _db.attachedDatabase,
        _db.flashcardDecks,
      );
  $$FlashcardReviewCardsTableTableManager get flashcardReviewCards =>
      $$FlashcardReviewCardsTableTableManager(
        _db.attachedDatabase,
        _db.flashcardReviewCards,
      );
}
