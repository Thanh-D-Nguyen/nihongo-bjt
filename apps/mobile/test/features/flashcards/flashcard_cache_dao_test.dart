import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/database/app_database.dart';
import 'package:nihongo_bjt/features/flashcards/data/local/flashcard_cache_dao.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_deck.dart';

void main() {
  late AppDatabase db;
  late FlashcardCacheDao dao;

  setUp(() {
    db = AppDatabase.forTesting(NativeDatabase.memory());
    dao = db.flashcardCacheDao;
  });

  tearDown(() => db.close());

  group('decks', () {
    test('upsert then read round-trips deck fields', () async {
      await dao.upsertDecks(const [
        FlashcardDeck(
          id: 'deck-1',
          title: 'BJT 語彙 J2',
          description: 'Từ vựng BJT J2',
          cardCount: 24,
        ),
      ]);

      final decks = await dao.readDecks();

      expect(decks, hasLength(1));
      expect(decks.single.id, 'deck-1');
      expect(decks.single.title, 'BJT 語彙 J2');
      expect(decks.single.description, 'Từ vựng BJT J2');
      expect(decks.single.cardCount, 24);
    });

    test('upsert overwrites an existing deck by id', () async {
      await dao.upsertDecks(const [
        FlashcardDeck(
          id: 'deck-1',
          title: 'old',
          description: 'old',
          cardCount: 1,
        ),
      ]);
      await dao.upsertDecks(const [
        FlashcardDeck(
          id: 'deck-1',
          title: 'BJT 語彙 J2',
          description: 'Từ vựng BJT J2',
          cardCount: 24,
        ),
      ]);

      final decks = await dao.readDecks();

      expect(decks, hasLength(1));
      expect(decks.single.title, 'BJT 語彙 J2');
      expect(decks.single.cardCount, 24);
    });

    test('empty upsert is a no-op', () async {
      await dao.upsertDecks(const []);
      expect(await dao.readDecks(), isEmpty);
    });
  });

  group('review cards', () {
    test('upsert then read round-trips card fields', () async {
      await dao.upsertReviewCards('deck-1', const [
        Flashcard(
          id: 'card-10',
          userFlashcardId: 'uf-100',
          front: '出張',
          reading: 'しゅっちょう',
          back: 'chuyến công tác',
        ),
      ]);

      final cards = await dao.readReviewCards('deck-1');

      expect(cards, hasLength(1));
      expect(cards.single.id, 'card-10');
      expect(cards.single.userFlashcardId, 'uf-100');
      expect(cards.single.front, '出張');
      expect(cards.single.reading, 'しゅっちょう');
      expect(cards.single.back, 'chuyến công tác');
    });

    test('reads only the cards cached for the requested deck', () async {
      await dao.upsertReviewCards('deck-1', const [
        Flashcard(
          id: 'card-10',
          userFlashcardId: 'uf-100',
          front: '出張',
          reading: 'しゅっちょう',
          back: 'chuyến công tác',
        ),
      ]);
      await dao.upsertReviewCards('deck-2', const [
        Flashcard(
          id: 'card-20',
          userFlashcardId: 'uf-200',
          front: '会議',
          reading: 'かいぎ',
          back: 'cuộc họp',
        ),
      ]);

      final deck1 = await dao.readReviewCards('deck-1');
      final deck2 = await dao.readReviewCards('deck-2');

      expect(deck1.map((c) => c.userFlashcardId), ['uf-100']);
      expect(deck2.map((c) => c.userFlashcardId), ['uf-200']);
    });

    test('upsert overwrites a card by (deckId, userFlashcardId)', () async {
      await dao.upsertReviewCards('deck-1', const [
        Flashcard(
          id: 'card-10',
          userFlashcardId: 'uf-100',
          front: 'old',
          reading: 'old',
          back: 'old',
        ),
      ]);
      await dao.upsertReviewCards('deck-1', const [
        Flashcard(
          id: 'card-10',
          userFlashcardId: 'uf-100',
          front: '出張',
          reading: 'しゅっちょう',
          back: 'chuyến công tác',
        ),
      ]);

      final cards = await dao.readReviewCards('deck-1');

      expect(cards, hasLength(1));
      expect(cards.single.front, '出張');
    });
  });
}
