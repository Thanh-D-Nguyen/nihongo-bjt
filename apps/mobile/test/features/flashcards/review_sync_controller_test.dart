import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/config/app_environment.dart';
import 'package:nihongo_bjt/core/database/app_database.dart';
import 'package:nihongo_bjt/features/auth/presentation/auth_controller.dart'
    show appEnvironmentProvider;
import 'package:nihongo_bjt/features/flashcards/data/flashcard_review_sync_service.dart';
import 'package:nihongo_bjt/features/flashcards/data/offline_review_queue.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_card_input.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_detail.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_form_input.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_deck.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/domain/srs_rating.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_providers.dart';

AppEnvironment _env(String source) => AppEnvironment(
  apiBaseUrl: 'https://api.test',
  keycloakIssuer: 'https://auth.test/realms/nihongo-bjt',
  oauthClientId: 'nihongo-mobile',
  oauthRedirectUri: 'com.nihongobjt.app://oauth2redirect',
  flashcardDataSource: source,
);

/// Remote whose [submitReviewRating] always succeeds, so a queue drain reports
/// every pending row as synced.
class _SucceedingRemote implements FlashcardRepository {
  @override
  Future<List<FlashcardDeck>> fetchDecks() => throw UnimplementedError();

  @override
  Future<DeckDetail> fetchDeckDetail(String deckId) =>
      throw UnimplementedError();

  @override
  Future<String> createDeck(DeckFormInput input) => throw UnimplementedError();

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
  Future<List<Flashcard>> fetchCards(String deckId) =>
      throw UnimplementedError();

  @override
  Future<void> submitReviewRating({
    required String userFlashcardId,
    required SrsRating rating,
  }) async {}
}

void main() {
  test('sync is a no-op in mock/dev mode', () async {
    final container = ProviderContainer(
      overrides: [appEnvironmentProvider.overrideWithValue(_env('mock'))],
    );
    addTearDown(container.dispose);

    final result = await container
        .read(reviewSyncControllerProvider.notifier)
        .sync();

    expect(result, isNull);
  });

  test('sync drains the offline queue and reports synced count', () async {
    final db = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(db.close);
    final queue = OfflineReviewQueue(db.reviewQueueDao);
    await queue.enqueueFailedReview(
      userFlashcardId: 'uf-1',
      rating: SrsRating.good,
    );
    await queue.enqueueFailedReview(
      userFlashcardId: 'uf-2',
      rating: SrsRating.easy,
    );

    final container = ProviderContainer(
      overrides: [
        appEnvironmentProvider.overrideWithValue(_env('api')),
        flashcardReviewSyncServiceProvider.overrideWithValue(
          FlashcardReviewSyncService(_SucceedingRemote(), queue),
        ),
      ],
    );
    addTearDown(container.dispose);

    final result = await container
        .read(reviewSyncControllerProvider.notifier)
        .sync();

    expect(result, isNotNull);
    expect(result!.synced, 2);
    expect(result.failed, 0);
    expect(await queue.pending(), isEmpty);
  });
}
