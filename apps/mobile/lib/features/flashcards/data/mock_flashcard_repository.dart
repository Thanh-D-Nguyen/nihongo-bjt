import 'package:nihongo_bjt/features/flashcards/domain/flashcard.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_deck.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/domain/srs_rating.dart';

/// In-memory [FlashcardRepository] for the Phase 2 vertical slice.
///
/// Holds a small, hand-verified set of business-Japanese (BJT) vocabulary.
/// Reads are async to match the real repository contract that replaces this
/// in a later phase. Submitted grades are recorded in-memory only.
class MockFlashcardRepository implements FlashcardRepository {
  MockFlashcardRepository();

  /// Grades submitted during the session, keyed by `userFlashcardId`. Exposed
  /// so tests can assert submission without any real persistence.
  final Map<String, SrsRating> submittedRatings = <String, SrsRating>{};

  static const List<FlashcardDeck> _decks = [
    FlashcardDeck(
      id: 'business-basics',
      title: 'ビジネス基礎',
      description: 'Từ vựng kinh doanh nền tảng',
      cardCount: 4,
    ),
    FlashcardDeck(
      id: 'meetings',
      title: '会議',
      description: 'Từ vựng dùng trong cuộc họp',
      cardCount: 3,
    ),
  ];

  static const Map<String, List<Flashcard>> _cardsByDeck = {
    'business-basics': [
      Flashcard(
        id: 'bb-1',
        userFlashcardId: 'uf-bb-1',
        front: '報告',
        reading: 'ほうこく',
        back: 'báo cáo',
      ),
      Flashcard(
        id: 'bb-2',
        userFlashcardId: 'uf-bb-2',
        front: '取引先',
        reading: 'とりひきさき',
        back: 'đối tác giao dịch (khách hàng)',
      ),
      Flashcard(
        id: 'bb-3',
        userFlashcardId: 'uf-bb-3',
        front: '納期',
        reading: 'のうき',
        back: 'thời hạn giao hàng',
      ),
      Flashcard(
        id: 'bb-4',
        userFlashcardId: 'uf-bb-4',
        front: '見積もり',
        reading: 'みつもり',
        back: 'báo giá, dự toán',
      ),
    ],
    'meetings': [
      Flashcard(
        id: 'mt-1',
        userFlashcardId: 'uf-mt-1',
        front: '会議',
        reading: 'かいぎ',
        back: 'cuộc họp',
      ),
      Flashcard(
        id: 'mt-2',
        userFlashcardId: 'uf-mt-2',
        front: '議題',
        reading: 'ぎだい',
        back: 'chủ đề (nội dung nghị sự)',
      ),
      Flashcard(
        id: 'mt-3',
        userFlashcardId: 'uf-mt-3',
        front: '議事録',
        reading: 'ぎじろく',
        back: 'biên bản cuộc họp',
      ),
    ],
  };

  @override
  Future<List<FlashcardDeck>> fetchDecks() async => _decks;

  @override
  Future<List<Flashcard>> fetchCards(String deckId) async =>
      _cardsByDeck[deckId] ?? const [];

  @override
  Future<void> submitReviewRating({
    required String userFlashcardId,
    required SrsRating rating,
  }) async {
    submittedRatings[userFlashcardId] = rating;
  }
}
