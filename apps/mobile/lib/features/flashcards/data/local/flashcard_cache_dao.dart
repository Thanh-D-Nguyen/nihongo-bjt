import 'package:drift/drift.dart';
import 'package:nihongo_bjt/core/database/app_database.dart';
import 'package:nihongo_bjt/features/flashcards/data/local/flashcard_cache_tables.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_deck.dart';

part 'flashcard_cache_dao.g.dart';

/// Minimal data-access object for the offline flashcard cache (Phase 6A).
///
/// Provides upsert/read for decks and review cards and maps rows to/from the
/// domain models. No write queue, sync state, or conflict resolution is here.
@DriftAccessor(tables: [FlashcardDecks, FlashcardReviewCards])
class FlashcardCacheDao extends DatabaseAccessor<AppDatabase>
    with _$FlashcardCacheDaoMixin {
  FlashcardCacheDao(super.attachedDatabase);

  /// Inserts or updates the given [decks], stamping each with the current time.
  Future<void> upsertDecks(List<FlashcardDeck> decks) async {
    if (decks.isEmpty) return;
    final now = DateTime.now().toUtc();
    await batch((batch) {
      batch.insertAllOnConflictUpdate(
        flashcardDecks,
        [
          for (final deck in decks)
            FlashcardDecksCompanion.insert(
              id: deck.id,
              title: deck.title,
              description: deck.description,
              cardCount: deck.cardCount,
              visibility: Value(deck.visibility.wire),
              cachedAt: now,
            ),
        ],
      );
    });
  }

  /// Reads all cached decks (insertion-stable order).
  Future<List<FlashcardDeck>> readDecks() async {
    final rows = await select(flashcardDecks).get();
    return [
      for (final row in rows)
        FlashcardDeck(
          id: row.id,
          title: row.title,
          description: row.description,
          cardCount: row.cardCount,
          visibility: DeckVisibility.fromWire(row.visibility),
        ),
    ];
  }

  /// Inserts or updates the [cards] cached for [deckId].
  Future<void> upsertReviewCards(String deckId, List<Flashcard> cards) async {
    if (cards.isEmpty) return;
    final now = DateTime.now().toUtc();
    await batch((batch) {
      batch.insertAllOnConflictUpdate(
        flashcardReviewCards,
        [
          for (final card in cards)
            FlashcardReviewCardsCompanion.insert(
              deckId: deckId,
              userFlashcardId: card.userFlashcardId,
              cardId: card.id,
              front: card.front,
              reading: card.reading,
              back: card.back,
              cachedAt: now,
            ),
        ],
      );
    });
  }

  /// Reads the review cards cached for [deckId].
  Future<List<Flashcard>> readReviewCards(String deckId) async {
    final query = select(flashcardReviewCards)
      ..where((row) => row.deckId.equals(deckId));
    final rows = await query.get();
    return [
      for (final row in rows)
        Flashcard(
          id: row.cardId,
          userFlashcardId: row.userFlashcardId,
          front: row.front,
          reading: row.reading,
          back: row.back,
        ),
    ];
  }
}
