import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/flashcards/data/mock_flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/domain/add_mistakes_to_deck.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_card_input.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_deck.dart';

void main() {
  group('AddMistakesToDeck', () {
    late MockFlashcardRepository repository;
    late AddMistakesToDeck addMistakes;

    setUp(() {
      repository = MockFlashcardRepository();
      addMistakes = AddMistakesToDeck(repository);
    });

    List<DeckCardInput> sampleCards() => [
      DeckCardInput.fromRaw(
        frontText: '次の語を選びなさい。',
        backText: 'Câu này sai vì dùng nhầm ngữ cảnh.',
        reading: '',
      ),
      DeckCardInput.fromRaw(
        frontText: '正しい敬語はどれですか。',
        backText: 'Phải dùng khiêm nhường ngữ.',
        reading: '',
      ),
    ];

    test('creates a new private deck holding every mistake card', () async {
      final before = await repository.fetchDecks();

      final deckId = await addMistakes(
        deckTitle: 'Ôn lỗi: Đề thi thử BJT',
        cards: sampleCards(),
      );

      final after = await repository.fetchDecks();
      expect(after.length, before.length + 1);

      final detail = await repository.fetchDeckDetail(deckId);
      expect(detail.titleVi, 'Ôn lỗi: Đề thi thử BJT');
      expect(detail.visibility, DeckVisibility.private);
      expect(detail.cards.length, 2);
      expect(detail.cards.first.frontText, '次の語を選びなさい。');
      expect(detail.cards.first.backText, 'Câu này sai vì dùng nhầm ngữ cảnh.');
    });

    test('trims the deck title', () async {
      final deckId = await addMistakes(
        deckTitle: '   Ôn lỗi bài thi   ',
        cards: sampleCards(),
      );

      final detail = await repository.fetchDeckDetail(deckId);
      expect(detail.titleVi, 'Ôn lỗi bài thi');
    });

    test('throws on a blank title without creating a deck', () async {
      final before = await repository.fetchDecks();

      expect(
        () => addMistakes(deckTitle: '   ', cards: sampleCards()),
        throwsArgumentError,
      );

      final after = await repository.fetchDecks();
      expect(after.length, before.length);
    });

    test('throws on an empty card list without creating a deck', () async {
      final before = await repository.fetchDecks();

      expect(
        () => addMistakes(deckTitle: 'Ôn lỗi', cards: const []),
        throwsArgumentError,
      );

      final after = await repository.fetchDecks();
      expect(after.length, before.length);
    });
  });
}
