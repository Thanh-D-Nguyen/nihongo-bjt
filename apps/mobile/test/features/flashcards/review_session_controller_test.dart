import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/flashcards/data/mock_flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_card_input.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_detail.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_form_input.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_deck.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/domain/srs_rating.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_providers.dart';

/// Records grade submissions while delegating reads to the in-memory mock, so
/// tests can assert the controller submits on rate without a real backend.
class _RecordingRepository implements FlashcardRepository {
  _RecordingRepository(this._delegate);

  final MockFlashcardRepository _delegate;
  final List<({String userFlashcardId, SrsRating rating})> submissions = [];

  @override
  Future<List<FlashcardDeck>> fetchDecks() => _delegate.fetchDecks();

  @override
  Future<DeckDetail> fetchDeckDetail(String deckId) =>
      _delegate.fetchDeckDetail(deckId);

  @override
  Future<String> createDeck(DeckFormInput input) =>
      _delegate.createDeck(input);

  @override
  Future<String> createDeckWithCards(
    DeckFormInput meta,
    List<DeckCardInput> cards,
  ) =>
      _delegate.createDeckWithCards(meta, cards);

  @override
  Future<void> updateDeckMeta(String deckId, DeckFormInput input) =>
      _delegate.updateDeckMeta(deckId, input);

  @override
  Future<void> archiveDeck(String deckId) => _delegate.archiveDeck(deckId);

  @override
  Future<void> saveDeckCards(
    String deckId,
    DeckFormInput meta,
    List<DeckCardInput> cards,
  ) =>
      _delegate.saveDeckCards(deckId, meta, cards);

  @override
  Future<List<Flashcard>> fetchCards(String deckId) =>
      _delegate.fetchCards(deckId);

  @override
  Future<void> submitReviewRating({
    required String userFlashcardId,
    required SrsRating rating,
  }) async {
    submissions.add((userFlashcardId: userFlashcardId, rating: rating));
  }
}

void main() {
  group('ReviewSessionController', () {
    late ProviderContainer container;

    setUp(() {
      container = ProviderContainer();
      addTearDown(container.dispose);
    });

    test('reveals, grades each card, and reaches completion', () async {
      final provider = reviewSessionProvider('meetings');
      final sub = container.listen(provider, (_, _) {});
      addTearDown(sub.close);

      final initial = await container.read(provider.future);
      expect(initial.totalCount, 3);
      expect(initial.isComplete, isFalse);
      expect(initial.answerRevealed, isFalse);

      final controller = container.read(provider.notifier)..revealAnswer();
      expect(container.read(provider).value!.answerRevealed, isTrue);

      controller
        ..rate(SrsRating.good)
        ..rate(SrsRating.again)
        ..rate(SrsRating.easy);

      final done = container.read(provider).value!;
      expect(done.isComplete, isTrue);
      expect(done.reviewedCount, 3);
      expect(done.ratings.length, 3);
      expect(done.ratings.values, contains(SrsRating.again));
    });

    test('rate is ignored once the session is complete', () async {
      final provider = reviewSessionProvider('meetings');
      final sub = container.listen(provider, (_, _) {});
      addTearDown(sub.close);

      await container.read(provider.future);
      final controller = container.read(provider.notifier)
        ..rate(SrsRating.good)
        ..rate(SrsRating.good)
        ..rate(SrsRating.good);

      expect(container.read(provider).value!.isComplete, isTrue);
      controller.rate(SrsRating.easy);
      expect(container.read(provider).value!.ratings.length, 3);
    });

    test('restart clears progress and grades', () async {
      final provider = reviewSessionProvider('meetings');
      final sub = container.listen(provider, (_, _) {});
      addTearDown(sub.close);

      await container.read(provider.future);
      container.read(provider.notifier)
        ..rate(SrsRating.good)
        ..restart();

      final state = container.read(provider).value!;
      expect(state.currentIndex, 0);
      expect(state.ratings, isEmpty);
    });

    test('submits each grade to the repository on rate', () async {
      final recording = _RecordingRepository(MockFlashcardRepository());
      final scoped = ProviderContainer(
        overrides: [
          flashcardRepositoryProvider.overrideWithValue(recording),
        ],
      );
      addTearDown(scoped.dispose);

      final provider = reviewSessionProvider('meetings');
      final sub = scoped.listen(provider, (_, _) {});
      addTearDown(sub.close);

      await scoped.read(provider.future);
      scoped.read(provider.notifier).rate(SrsRating.good);
      // Let the optimistic, unawaited submit complete.
      await Future<void>.delayed(Duration.zero);

      expect(recording.submissions, hasLength(1));
      expect(recording.submissions.single.userFlashcardId, 'uf-mt-1');
      expect(recording.submissions.single.rating, SrsRating.good);
      // A successful submit leaves no unsynced reviews.
      expect(scoped.read(provider).value!.unsyncedReviewIds, isEmpty);
    });
  });
}
