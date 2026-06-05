import 'package:nihongo_bjt/features/flashcards/domain/deck_card_input.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_form_input.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_repository.dart';

/// Appends a single looked-up term to an existing learner-owned deck.
///
/// Reading Assist exposes an "add to flashcard" action on its lookup sheet;
/// this use-case turns that term + reading + meaning into a real card. Because
/// the backend replaces a deck's whole card set on update, it re-reads the
/// deck's current cards, appends the new one, and resends the COMPLETE list —
/// preserving every existing card (and its shared id) plus the deck metadata.
///
/// The authenticated learner is resolved server-side; nothing here carries a
/// user id. A Vietnamese `meaning` is required because the card back is a
/// mandatory field server-side — callers must only offer the action when a
/// meaning is available.
class AddTermToDeck {
  const AddTermToDeck(this._repository);

  final FlashcardRepository _repository;

  /// Adds a card (`term` front, `meaning` back, optional `reading`) to the
  /// deck identified by `deckId`.
  ///
  /// Throws [ArgumentError] when [term] or [meaning] is blank (an invalid card
  /// the server would reject anyway). Propagates repository errors so the
  /// caller can surface a real failure message — never a fake success.
  Future<void> call({
    required String deckId,
    required String term,
    required String meaning,
    String? reading,
  }) async {
    final trimmedTerm = term.trim();
    final trimmedMeaning = meaning.trim();
    if (trimmedTerm.isEmpty) {
      throw ArgumentError.value(term, 'term', 'must not be blank');
    }
    if (trimmedMeaning.isEmpty) {
      throw ArgumentError.value(meaning, 'meaning', 'must not be blank');
    }

    final detail = await _repository.fetchDeckDetail(deckId);
    final cards = detail.cards.map(DeckCardInput.fromDeckCard).toList()
      ..add(
        DeckCardInput.fromRaw(
          frontText: trimmedTerm,
          backText: trimmedMeaning,
          reading: reading ?? '',
        ),
      );
    final meta = DeckFormInput(
      titleVi: detail.titleVi,
      titleJa: detail.titleJa,
      descriptionVi: detail.descriptionVi,
      descriptionJa: detail.descriptionJa,
      visibility: detail.visibility,
    );

    await _repository.saveDeckCards(deckId, meta, cards);
  }
}
