import 'package:nihongo_bjt/features/flashcards/domain/deck_card_input.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_detail.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_form_input.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_deck.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/domain/srs_rating.dart';

/// In-memory [FlashcardRepository] for dev/test.
///
/// Holds a small, hand-verified set of business-Japanese (BJT) vocabulary and
/// supports the full deck CRUD surface (create/update/archive) against mutable
/// in-memory state, so the form flows are exercisable without a backend. Reads
/// are async to match the real repository contract. Submitted grades and deck
/// mutations are recorded in-memory only.
class MockFlashcardRepository implements FlashcardRepository {
  MockFlashcardRepository() {
    _decks = List<DeckDetail>.from(_seedDecks());
  }

  /// Grades submitted during the session, keyed by `userFlashcardId`. Exposed
  /// so tests can assert submission without any real persistence.
  final Map<String, SrsRating> submittedRatings = <String, SrsRating>{};

  /// Mutable deck store. Seeded once per instance from [_seedDecks].
  late List<DeckDetail> _decks;

  int _generatedDeckCounter = 0;
  int _generatedCardCounter = 0;

  static List<DeckDetail> _seedDecks() => const [
    DeckDetail(
      id: 'business-basics',
      titleVi: 'ビジネス基礎',
      titleJa: 'ビジネス基礎',
      descriptionVi: 'Từ vựng kinh doanh nền tảng',
      cards: [
        DeckCard(
          deckCardId: 'dc-bb-1',
          cardId: 'bb-1',
          position: 0,
          frontText: '報告',
          backText: 'báo cáo',
          reading: 'ほうこく',
        ),
        DeckCard(
          deckCardId: 'dc-bb-2',
          cardId: 'bb-2',
          position: 1,
          frontText: '取引先',
          backText: 'đối tác giao dịch (khách hàng)',
          reading: 'とりひきさき',
        ),
        DeckCard(
          deckCardId: 'dc-bb-3',
          cardId: 'bb-3',
          position: 2,
          frontText: '納期',
          backText: 'thời hạn giao hàng',
          reading: 'のうき',
        ),
        DeckCard(
          deckCardId: 'dc-bb-4',
          cardId: 'bb-4',
          position: 3,
          frontText: '見積もり',
          backText: 'báo giá, dự toán',
          reading: 'みつもり',
        ),
      ],
    ),
    DeckDetail(
      id: 'meetings',
      titleVi: '会議',
      titleJa: '会議',
      descriptionVi: 'Từ vựng dùng trong cuộc họp',
      visibility: DeckVisibility.public,
      cards: [
        DeckCard(
          deckCardId: 'dc-mt-1',
          cardId: 'mt-1',
          position: 0,
          frontText: '会議',
          backText: 'cuộc họp',
          reading: 'かいぎ',
        ),
        DeckCard(
          deckCardId: 'dc-mt-2',
          cardId: 'mt-2',
          position: 1,
          frontText: '議題',
          backText: 'chủ đề (nội dung nghị sự)',
          reading: 'ぎだい',
        ),
        DeckCard(
          deckCardId: 'dc-mt-3',
          cardId: 'mt-3',
          position: 2,
          frontText: '議事録',
          backText: 'biên bản cuộc họp',
          reading: 'ぎじろく',
        ),
      ],
    ),
  ];

  @override
  Future<List<FlashcardDeck>> fetchDecks() async {
    return _decks
        .map(
          (d) => FlashcardDeck(
            id: d.id,
            title: d.displayTitle,
            description: d.displayDescription,
            cardCount: d.cardCount,
            visibility: d.visibility,
          ),
        )
        .toList();
  }

  @override
  Future<DeckDetail> fetchDeckDetail(String deckId) async {
    return _decks.firstWhere(
      (d) => d.id == deckId,
      orElse: () => throw const FlashcardRepositoryMockException(
        'Không tìm thấy bộ thẻ.',
      ),
    );
  }

  @override
  Future<String> createDeck(DeckFormInput input) async {
    _generatedDeckCounter += 1;
    final id = 'deck-local-$_generatedDeckCounter';
    _decks = [
      ..._decks,
      DeckDetail(
        id: id,
        titleVi: input.titleVi,
        titleJa: input.titleJa,
        descriptionVi: input.descriptionVi,
        descriptionJa: input.descriptionJa,
        visibility: input.visibility,
        cards: const [],
      ),
    ];
    return id;
  }

  @override
  Future<void> updateDeckMeta(String deckId, DeckFormInput input) async {
    final index = _decks.indexWhere((d) => d.id == deckId);
    if (index < 0) {
      throw const FlashcardRepositoryMockException('Không tìm thấy bộ thẻ.');
    }
    final existing = _decks[index];
    _decks = [
      ..._decks.sublist(0, index),
      DeckDetail(
        id: existing.id,
        titleVi: input.titleVi,
        titleJa: input.titleJa,
        descriptionVi: input.descriptionVi,
        descriptionJa: input.descriptionJa,
        visibility: input.visibility,
        cards: existing.cards,
      ),
      ..._decks.sublist(index + 1),
    ];
  }

  @override
  Future<void> saveDeckCards(
    String deckId,
    DeckFormInput meta,
    List<DeckCardInput> cards,
  ) async {
    final index = _decks.indexWhere((d) => d.id == deckId);
    if (index < 0) {
      throw const FlashcardRepositoryMockException('Không tìm thấy bộ thẻ.');
    }
    final existing = _decks[index];
    _generatedCardCounter += cards.length;
    final rebuilt = <DeckCard>[
      for (var i = 0; i < cards.length; i++)
        DeckCard(
          deckCardId:
              cards[i].deckCardId ?? 'dc-local-${_generatedCardCounter - i}',
          cardId: cards[i].cardId ?? 'card-local-${_generatedCardCounter - i}',
          position: i,
          frontText: cards[i].frontText,
          backText: cards[i].backText,
          reading: cards[i].reading ?? '',
          imageUrl: cards[i].imageUrl,
        ),
    ];
    _decks = [
      ..._decks.sublist(0, index),
      DeckDetail(
        id: existing.id,
        titleVi: meta.titleVi,
        titleJa: meta.titleJa,
        descriptionVi: meta.descriptionVi,
        descriptionJa: meta.descriptionJa,
        visibility: meta.visibility,
        cards: rebuilt,
      ),
      ..._decks.sublist(index + 1),
    ];
  }

  @override
  Future<void> archiveDeck(String deckId) async {
    _decks = _decks.where((d) => d.id != deckId).toList();
  }

  @override
  Future<List<Flashcard>> fetchCards(String deckId) async {
    // An empty id mirrors the API's global due queue (`/reviews/due` with no
    // `deckId`): aggregate every deck's cards. A concrete id scopes to that
    // deck only.
    final trimmed = deckId.trim();
    final decks = trimmed.isEmpty
        ? _decks
        : _decks.where((d) => d.id == trimmed);
    return decks
        .expand((d) => d.cards)
        .map(
          (c) => Flashcard(
            id: c.cardId,
            userFlashcardId: 'uf-${c.cardId}',
            front: c.frontText,
            reading: c.reading,
            back: c.backText,
          ),
        )
        .toList();
  }

  @override
  Future<void> submitReviewRating({
    required String userFlashcardId,
    required SrsRating rating,
  }) async {
    submittedRatings[userFlashcardId] = rating;
  }
}

/// Failure raised by [MockFlashcardRepository] for missing data, matching the
/// learner-facing message style of the API repository.
class FlashcardRepositoryMockException implements Exception {
  const FlashcardRepositoryMockException(this.message);

  final String message;

  @override
  String toString() => 'FlashcardRepositoryMockException: $message';
}
