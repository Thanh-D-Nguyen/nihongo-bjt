import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nihongo_bjt/core/api/repository_result.dart';
import 'package:nihongo_bjt/features/auth/presentation/auth_controller.dart';
import 'package:nihongo_bjt/features/flashcards/data/api_flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_providers.dart';
import 'package:nihongo_bjt/features/home/domain/home_dashboard_data.dart';
import 'package:nihongo_bjt/features/learn/presentation/learn_providers.dart';
import 'package:nihongo_bjt/features/progress/presentation/progress_providers.dart';

/// Builds the home Learning Dashboard snapshot from existing data seams.
///
/// Each section is loaded independently so Home can render partial data instead
/// of fabricating fallback metrics or collapsing when an optional source fails.
final homeDashboardProvider = FutureProvider<HomeDashboardData>((ref) async {
  int? deckCount;
  int? totalCards;
  int? pendingSync;
  RepositoryErrorKind? flashcardsErrorKind;
  try {
    final decks = await ref.watch(flashcardRepositoryProvider).fetchDecks();
    deckCount = decks.length;
    totalCards = decks.fold<int>(0, (sum, deck) => sum + deck.cardCount);

    if (ref.watch(appEnvironmentProvider).useApiFlashcards) {
      final pending = await ref.watch(offlineReviewQueueProvider).pending();
      pendingSync = pending.length;
    }
  } on FlashcardRepositoryException {
    flashcardsErrorKind = RepositoryErrorKind.server;
  } on RepositoryException catch (error) {
    flashcardsErrorKind = error.kind;
  }

  final dailyLesson = await AsyncValue.guard(
    () => ref.watch(dailyLessonProvider.future),
  );
  final studySummary = await AsyncValue.guard(
    () => ref.watch(studySummaryProvider.future),
  );

  return HomeDashboardData(
    deckCount: deckCount,
    totalCardCount: totalCards,
    pendingSyncCount: pendingSync,
    flashcardsErrorKind: flashcardsErrorKind,
    dailyLesson: dailyLesson.value,
    dailyLessonErrorKind: _errorKind(dailyLesson.error),
    studySummary: studySummary.value,
    studySummaryErrorKind: _errorKind(studySummary.error),
  );
});

RepositoryErrorKind? _errorKind(Object? error) {
  if (error == null) return null;
  if (error is RepositoryException) return error.kind;
  return RepositoryErrorKind.server;
}
