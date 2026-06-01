import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/flashcards/data/mock_flashcard_repository.dart';

void main() {
  final repo = MockFlashcardRepository();

  test('every deck reports a card count matching its cards', () async {
    final decks = await repo.fetchDecks();
    expect(decks, isNotEmpty);

    for (final deck in decks) {
      final cards = await repo.fetchCards(deck.id);
      expect(cards.length, deck.cardCount, reason: 'count mismatch ${deck.id}');
      final ids = cards.map((c) => c.id).toSet();
      expect(ids.length, cards.length, reason: 'duplicate ids ${deck.id}');
    }
  });

  test('unknown deck id returns an empty list', () async {
    expect(await repo.fetchCards('does-not-exist'), isEmpty);
  });
}
