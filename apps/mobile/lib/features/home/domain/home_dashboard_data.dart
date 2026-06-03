import 'package:nihongo_bjt/core/api/repository_result.dart';
import 'package:nihongo_bjt/features/learn/domain/lesson.dart';
import 'package:nihongo_bjt/features/progress/domain/study_summary.dart';

/// Immutable, partial-safe snapshot backing the home Learning Dashboard.
///
/// Every metric is derived from a real data source. Values the app cannot prove
/// are left absent and rendered as honest unavailable/empty states.
class HomeDashboardData {
  const HomeDashboardData({
    this.deckCount,
    this.totalCardCount,
    this.pendingSyncCount,
    this.flashcardsErrorKind,
    this.dailyLesson,
    this.dailyLessonErrorKind,
    this.studySummary,
    this.studySummaryErrorKind,
  });

  /// Number of decks available to the learner (`fetchDecks().length`).
  final int? deckCount;

  /// Total cards across all decks (sum of each deck's `cardCount`). This is the
  /// real pool of cards the learner can review right now.
  final int? totalCardCount;

  /// Reviews queued offline awaiting manual sync, or `null` when sync does not
  /// apply (mock data source has no queue). Never fabricated.
  final int? pendingSyncCount;

  /// Why flashcard deck/card metrics are unavailable, if the source failed.
  final RepositoryErrorKind? flashcardsErrorKind;

  /// Today's lesson from the active lesson repository. May be local preview
  /// content and is surfaced as such by the UI.
  final Lesson? dailyLesson;

  /// Why the daily lesson entry is unavailable, if the source failed.
  final RepositoryErrorKind? dailyLessonErrorKind;

  /// Honest device-local progress summary. Empty means no recorded activity,
  /// not a fabricated zero-progress server metric.
  final StudySummary? studySummary;

  /// Why progress could not be read, if the source failed.
  final RepositoryErrorKind? studySummaryErrorKind;

  /// Whether the learner has any deck to study.
  bool get hasDecks => (deckCount ?? 0) > 0;

  /// Whether real flashcard metrics are available.
  bool get hasFlashcardMetrics {
    return deckCount != null &&
        totalCardCount != null &&
        flashcardsErrorKind == null;
  }

  /// Whether an offline sync status is available to display.
  bool get hasSyncStatus => pendingSyncCount != null;

  /// Whether any optional Home source failed while other sections can render.
  bool get hasPartialFailure {
    return flashcardsErrorKind != null ||
        dailyLessonErrorKind != null ||
        studySummaryErrorKind != null;
  }
}
