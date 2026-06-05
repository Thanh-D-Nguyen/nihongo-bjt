import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/flashcards/data/mock_flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/domain/add_term_to_deck.dart';

void main() {
  group('AddTermToDeck', () {
    late MockFlashcardRepository repository;
    late AddTermToDeck addTerm;

    setUp(() {
      repository = MockFlashcardRepository();
      addTerm = AddTermToDeck(repository);
    });

    test('appends a new card and preserves existing cards', () async {
      const deckId = 'business-basics';
      final before = await repository.fetchDeckDetail(deckId);

      await addTerm(
        deckId: deckId,
        term: '出張',
        meaning: 'công tác',
        reading: 'しゅっちょう',
      );

      final after = await repository.fetchDeckDetail(deckId);
      expect(after.cards.length, before.cards.length + 1);
      // Existing cards still present (by front text).
      for (final card in before.cards) {
        expect(
          after.cards.any((c) => c.frontText == card.frontText),
          isTrue,
          reason: 'existing card ${card.frontText} must be preserved',
        );
      }
      final added = after.cards.last;
      expect(added.frontText, '出張');
      expect(added.backText, 'công tác');
      expect(added.reading, 'しゅっちょう');
    });

    test('preserves deck metadata when adding a card', () async {
      const deckId = 'business-basics';
      final before = await repository.fetchDeckDetail(deckId);

      await addTerm(deckId: deckId, term: '契約', meaning: 'hợp đồng');

      final after = await repository.fetchDeckDetail(deckId);
      expect(after.titleVi, before.titleVi);
      expect(after.titleJa, before.titleJa);
      expect(after.descriptionVi, before.descriptionVi);
      expect(after.visibility, before.visibility);
    });

    test('trims term and meaning', () async {
      const deckId = 'business-basics';

      await addTerm(deckId: deckId, term: '  残業 ', meaning: '  tăng ca ');

      final after = await repository.fetchDeckDetail(deckId);
      final added = after.cards.last;
      expect(added.frontText, '残業');
      expect(added.backText, 'tăng ca');
    });

    test('throws on blank term without touching the repository', () async {
      const deckId = 'business-basics';
      final before = await repository.fetchDeckDetail(deckId);

      expect(
        () => addTerm(deckId: deckId, term: '   ', meaning: 'x'),
        throwsArgumentError,
      );

      final after = await repository.fetchDeckDetail(deckId);
      expect(after.cards.length, before.cards.length);
    });

    test('throws on blank meaning', () async {
      expect(
        () => addTerm(deckId: 'business-basics', term: '残業', meaning: '  '),
        throwsArgumentError,
      );
    });

    test('propagates repository error for an unknown deck', () async {
      expect(
        () => addTerm(deckId: 'does-not-exist', term: '残業', meaning: 'x'),
        throwsA(isA<FlashcardRepositoryMockException>()),
      );
    });
  });
}
