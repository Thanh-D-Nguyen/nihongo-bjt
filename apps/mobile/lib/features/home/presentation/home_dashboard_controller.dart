import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nihongo_bjt/features/auth/presentation/auth_controller.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_providers.dart';
import 'package:nihongo_bjt/features/home/domain/home_dashboard_data.dart';

/// Builds the home Learning Dashboard snapshot from existing data seams.
///
/// Reads decks from the shared [flashcardRepositoryProvider] (same source the
/// deck-list screen uses) and the offline review queue only when the API data
/// source is active — the mock source has no queue, so the sync metric stays
/// `null` instead of showing a fabricated zero. No new API call is introduced.
final homeDashboardProvider = FutureProvider<HomeDashboardData>((ref) async {
  final decks = await ref.watch(flashcardRepositoryProvider).fetchDecks();
  final totalCards = decks.fold<int>(0, (sum, deck) => sum + deck.cardCount);

  int? pendingSync;
  if (ref.watch(appEnvironmentProvider).useApiFlashcards) {
    final pending = await ref.watch(offlineReviewQueueProvider).pending();
    pendingSync = pending.length;
  }

  return HomeDashboardData(
    deckCount: decks.length,
    totalCardCount: totalCards,
    pendingSyncCount: pendingSync,
  );
});
