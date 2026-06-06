import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/database/app_database.dart';
import 'package:nihongo_bjt/features/flashcards/data/api_flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/data/cached_flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/data/local/flashcard_cache_dao.dart';
import 'package:nihongo_bjt/features/flashcards/data/local/review_queue_dao.dart';
import 'package:nihongo_bjt/features/flashcards/data/offline_review_queue.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_card_input.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_detail.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_form_input.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_deck.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/domain/srs_rating.dart';

/// Configurable fake remote: either returns canned data or throws the
/// repository's own failure type, so cache fallback can be exercised.
class _FakeRemote implements FlashcardRepository {
  List<FlashcardDeck> decks = const [];
  List<Flashcard> cards = const [];
  bool fail = false;
  bool submitFail = false;
  final List<(String, SrsRating)> submissions = [];

  @override
  Future<List<FlashcardDeck>> fetchDecks() async {
    if (fail) throw const FlashcardRepositoryException('offline');
    return decks;
  }

  @override
  Future<DeckDetail> fetchDeckDetail(String deckId) =>
      throw UnimplementedError();

  @override
  Future<String> createDeck(DeckFormInput input) => throw UnimplementedError();

  @override
  Future<String> createDeckWithCards(
    DeckFormInput meta,
    List<DeckCardInput> cards,
  ) =>
      throw UnimplementedError();

  @override
  Future<void> updateDeckMeta(String deckId, DeckFormInput input) =>
      throw UnimplementedError();

  @override
  Future<void> archiveDeck(String deckId) => throw UnimplementedError();

  @override
  Future<void> saveDeckCards(
    String deckId,
    DeckFormInput meta,
    List<DeckCardInput> cards,
  ) =>
      throw UnimplementedError();

  @override
  Future<List<Flashcard>> fetchCards(String deckId) async {
    if (fail) throw const FlashcardRepositoryException('offline');
    return cards;
  }

  @override
  Future<void> submitReviewRating({
    required String userFlashcardId,
    required SrsRating rating,
  }) async {
    if (submitFail) throw const FlashcardRepositoryException('offline');
    submissions.add((userFlashcardId, rating));
  }
}

void main() {
  late AppDatabase db;
  late FlashcardCacheDao dao;
  late OfflineReviewQueue queue;
  late _FakeRemote remote;
  late CachedFlashcardRepository repo;

  const deck = FlashcardDeck(
    id: 'deck-1',
    title: 'BJT 語彙 J2',
    description: 'Từ vựng BJT J2',
    cardCount: 24,
  );
  const card = Flashcard(
    id: 'card-10',
    userFlashcardId: 'uf-100',
    front: '出張',
    reading: 'しゅっちょう',
    back: 'chuyến công tác',
  );

  setUp(() {
    db = AppDatabase.forTesting(NativeDatabase.memory());
    dao = db.flashcardCacheDao;
    queue = OfflineReviewQueue(ReviewQueueDao(db));
    remote = _FakeRemote();
    repo = CachedFlashcardRepository(remote, dao, queue);
  });

  tearDown(() => db.close());

  group('fetchDecks', () {
    test('returns remote result and caches it', () async {
      remote.decks = const [deck];

      final result = await repo.fetchDecks();

      expect(result.single.id, 'deck-1');
      expect((await dao.readDecks()).single.id, 'deck-1');
    });

    test('falls back to cache when the remote fails', () async {
      await dao.upsertDecks(const [deck]);
      remote.fail = true;

      final result = await repo.fetchDecks();

      expect(result.single.id, 'deck-1');
    });

    test('rethrows when the remote fails and the cache is empty', () async {
      remote.fail = true;

      expect(repo.fetchDecks(), throwsA(isA<FlashcardRepositoryException>()));
    });
  });

  group('fetchCards', () {
    test('returns remote result and caches it', () async {
      remote.cards = const [card];

      final result = await repo.fetchCards('deck-1');

      expect(result.single.userFlashcardId, 'uf-100');
      expect((await dao.readReviewCards('deck-1')).single.id, 'card-10');
    });

    test('falls back to cache when the remote fails', () async {
      await dao.upsertReviewCards('deck-1', const [card]);
      remote.fail = true;

      final result = await repo.fetchCards('deck-1');

      expect(result.single.userFlashcardId, 'uf-100');
    });

    test('rethrows when the remote fails and the cache is empty', () async {
      remote.fail = true;

      expect(
        repo.fetchCards('deck-1'),
        throwsA(isA<FlashcardRepositoryException>()),
      );
    });
  });

  group('submitReviewRating', () {
    test('delegates to the remote and does not enqueue on success', () async {
      await repo.submitReviewRating(
        userFlashcardId: 'uf-100',
        rating: SrsRating.good,
      );

      expect(remote.submissions, [('uf-100', SrsRating.good)]);
      expect(await queue.pending(), isEmpty);
    });

    test('enqueues then rethrows when the remote submit fails', () async {
      remote.submitFail = true;

      await expectLater(
        repo.submitReviewRating(
          userFlashcardId: 'uf-100',
          rating: SrsRating.again,
        ),
        throwsA(isA<FlashcardRepositoryException>()),
      );

      final pending = await queue.pending();
      expect(pending, hasLength(1));
      expect(pending.single.userFlashcardId, 'uf-100');
      expect(pending.single.rating, SrsRating.again);
    });
  });
}
