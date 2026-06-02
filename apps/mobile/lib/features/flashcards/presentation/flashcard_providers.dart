import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'package:nihongo_bjt/core/api/api_client.dart';
import 'package:nihongo_bjt/core/database/database_provider.dart';
import 'package:nihongo_bjt/features/auth/presentation/auth_controller.dart';
import 'package:nihongo_bjt/features/flashcards/data/api_flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/data/cached_flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/data/flashcard_review_sync_service.dart';
import 'package:nihongo_bjt/features/flashcards/data/mock_flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/data/offline_review_queue.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_deck.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/domain/srs_rating.dart';

/// [ApiClient] for the flashcard feature, wired to the Phase 4 auth seam: it
/// attaches the current learner's bearer token, or sends no token (→ server
/// 401) when there is no valid session. Only built when the API source is used.
final flashcardApiClientProvider = Provider<ApiClient>((ref) {
  final client = ApiClient(
    environment: ref.watch(appEnvironmentProvider),
    httpClient: http.Client(),
    accessTokenProvider: () =>
        ref.read(authControllerProvider.notifier).currentAccessToken(),
  );
  ref.onDispose(client.close);
  return client;
});

/// The bare API-backed flashcard repository (no cache, no offline queue).
/// Used directly by the sync service so a failed sync never re-enqueues.
final apiFlashcardRepositoryProvider = Provider<ApiFlashcardRepository>((ref) {
  return ApiFlashcardRepository(ref.watch(flashcardApiClientProvider));
});

/// Local offline queue for review grades that failed to submit online.
final offlineReviewQueueProvider = Provider<OfflineReviewQueue>((ref) {
  return OfflineReviewQueue(ref.watch(reviewQueueDaoProvider));
});

/// Manual drain of the offline review queue. No timer/background worker.
final flashcardReviewSyncServiceProvider = Provider<FlashcardReviewSyncService>(
  (ref) {
    return FlashcardReviewSyncService(
      ref.watch(apiFlashcardRepositoryProvider),
      ref.watch(offlineReviewQueueProvider),
    );
  },
);

/// The active flashcard data source. Defaults to the in-memory mock for stable
/// dev/test; switches to [ApiFlashcardRepository] (cache + offline queue) when
/// the environment selects `FLASHCARD_DATA_SOURCE=api`. Consumers are
/// unaffected by the choice. Mock mode never touches the database/queue.
final flashcardRepositoryProvider = Provider<FlashcardRepository>((ref) {
  if (ref.watch(appEnvironmentProvider).useApiFlashcards) {
    return CachedFlashcardRepository(
      ref.watch(apiFlashcardRepositoryProvider),
      ref.watch(flashcardCacheDaoProvider),
      ref.watch(offlineReviewQueueProvider),
    );
  }
  return MockFlashcardRepository();
});

/// All decks shown on the deck-list screen.
final deckListProvider = FutureProvider<List<FlashcardDeck>>((ref) {
  return ref.watch(flashcardRepositoryProvider).fetchDecks();
});

/// Immutable state of one review session, held in memory for Phase 2.
class ReviewSessionState {
  const ReviewSessionState({
    required this.cards,
    this.currentIndex = 0,
    this.answerRevealed = false,
    this.ratings = const {},
    this.unsyncedReviewIds = const {},
  });

  final List<Flashcard> cards;
  final int currentIndex;
  final bool answerRevealed;

  /// SRS grade recorded per card id. This is the in-memory SRS state.
  final Map<String, SrsRating> ratings;

  /// `userFlashcardId`s whose grade could not be submitted to the server
  /// (offline / no session). Seeds the future offline-sync phase; the local
  /// grade in [ratings] is unaffected.
  final Set<String> unsyncedReviewIds;

  bool get isComplete => currentIndex >= cards.length;

  Flashcard? get currentCard => isComplete ? null : cards[currentIndex];

  int get totalCount => cards.length;

  int get reviewedCount => currentIndex.clamp(0, cards.length);

  ReviewSessionState copyWith({
    int? currentIndex,
    bool? answerRevealed,
    Map<String, SrsRating>? ratings,
    Set<String>? unsyncedReviewIds,
  }) {
    return ReviewSessionState(
      cards: cards,
      currentIndex: currentIndex ?? this.currentIndex,
      answerRevealed: answerRevealed ?? this.answerRevealed,
      ratings: ratings ?? this.ratings,
      unsyncedReviewIds: unsyncedReviewIds ?? this.unsyncedReviewIds,
    );
  }
}

/// Drives a review session for a single deck.
///
/// Auto-disposed per deck id so leaving the screen resets progress (Phase 2
/// keeps no persistent SRS state). The provider's concrete type is internal to
/// Riverpod, so the variable type cannot be annotated explicitly.
// ignore: specify_nonobvious_property_types
final reviewSessionProvider = AsyncNotifierProvider.autoDispose
    .family<ReviewSessionController, ReviewSessionState, String>(
      ReviewSessionController.new,
    );

class ReviewSessionController extends AsyncNotifier<ReviewSessionState> {
  ReviewSessionController(this.deckId);

  final String deckId;

  @override
  Future<ReviewSessionState> build() async {
    final cards = await ref
        .watch(flashcardRepositoryProvider)
        .fetchCards(
          deckId,
        );
    return ReviewSessionState(cards: cards);
  }

  /// Reveal the answer of the current card.
  void revealAnswer() {
    final session = state.value;
    if (session == null || session.answerRevealed || session.isComplete) {
      return;
    }
    state = AsyncData(session.copyWith(answerRevealed: true));
  }

  /// Grade the current card with [rating] and advance to the next one.
  ///
  /// Advances the UI optimistically, then submits the grade to the repository.
  /// A failed submission is recorded in [ReviewSessionState.unsyncedReviewIds]
  /// (for the later offline-sync phase) and never blocks the review flow.
  void rate(SrsRating rating) {
    final session = state.value;
    if (session == null || session.isComplete) return;
    final card = session.currentCard;
    if (card == null) return;
    state = AsyncData(
      session.copyWith(
        currentIndex: session.currentIndex + 1,
        answerRevealed: false,
        ratings: {...session.ratings, card.id: rating},
      ),
    );
    unawaited(_submitRating(card.userFlashcardId, rating));
  }

  Future<void> _submitRating(String userFlashcardId, SrsRating rating) async {
    try {
      await ref
          .read(flashcardRepositoryProvider)
          .submitReviewRating(userFlashcardId: userFlashcardId, rating: rating);
    } on FlashcardRepositoryException {
      final session = state.value;
      if (session == null) return;
      state = AsyncData(
        session.copyWith(
          unsyncedReviewIds: {...session.unsyncedReviewIds, userFlashcardId},
        ),
      );
    }
  }

  /// Restart the session from the first card, clearing recorded grades.
  void restart() {
    final session = state.value;
    if (session == null) return;
    state = AsyncData(ReviewSessionState(cards: session.cards));
  }
}
