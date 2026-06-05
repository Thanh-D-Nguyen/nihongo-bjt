import 'package:nihongo_bjt/features/flashcards/domain/deck_card_input.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_form_input.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_deck.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_repository.dart';

/// Creates a brand-new private review deck from a learner's exam mistakes.
///
/// The exam review screen offers a "save my wrong answers" action: each
/// incorrect question (its prompt + Vietnamese explanation) becomes one card in
/// a freshly created private deck so the learner can drill the concepts they
/// missed. This mirrors the web quiz-results "add to flashcards" remediation
/// flow, but builds the cards from the breakdown the client already holds —
/// no separate backend remediation endpoint is required.
///
/// The authenticated learner is resolved server-side; nothing here carries a
/// user id. New cards are sent through the same create + full-set save path the
/// deck editor uses, so the deck is real and immediately reviewable.
class AddMistakesToDeck {
  const AddMistakesToDeck(this._repository);

  final FlashcardRepository _repository;

  /// Creates a private deck titled [deckTitle] holding [cards] and returns the
  /// new deck id.
  ///
  /// Throws [ArgumentError] when [deckTitle] is blank or [cards] is empty (an
  /// invalid deck the server would reject anyway). Propagates repository errors
  /// so the caller can surface a real failure — never a fake success.
  Future<String> call({
    required String deckTitle,
    required List<DeckCardInput> cards,
  }) async {
    final trimmedTitle = deckTitle.trim();
    if (trimmedTitle.isEmpty) {
      throw ArgumentError.value(deckTitle, 'deckTitle', 'must not be blank');
    }
    if (cards.isEmpty) {
      throw ArgumentError.value(cards, 'cards', 'must not be empty');
    }

    final meta = DeckFormInput(
      titleVi: trimmedTitle,
      visibility: DeckVisibility.private,
    );
    final deckId = await _repository.createDeck(meta);
    await _repository.saveDeckCards(deckId, meta, cards);
    return deckId;
  }
}
