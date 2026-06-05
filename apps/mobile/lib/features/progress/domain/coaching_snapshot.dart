/// Server-derived coaching signals for the Progress screen.
///
/// Mirrors the web analytics "next step" card 1:1 ([apps/web] analytics
/// client): a single recommended action plus an encouraging nudge, both
/// computed from real learner analytics (`GET /api/analytics/learner`). No
/// figure is fabricated — when the backend has no signals the snapshot is
/// honestly empty and the card is hidden.
library;

/// The recommended primary action for the learner right now.
enum CoachingAction {
  /// Review due flashcards (keep the SRS cadence).
  flashcards,

  /// Run a short BJT practice set.
  quiz,
}

/// Which contextual hint to show under the primary action.
enum CoachingHint { flashcardsDue, maintain, quizSkills, quizAccuracy }

/// Which encouraging nudge line to show below the action card.
enum CoachingNudge { due, weak, streak, calm }

/// Honest, server-derived coaching signals. Every field comes from the
/// learner analytics endpoint; the derived getters reproduce the web
/// decision logic so both clients recommend the same next step.
class CoachingSnapshot {
  const CoachingSnapshot({
    required this.dueFlashcards,
    required this.weakCount,
    required this.accuracyPct,
    required this.reviewCount,
    required this.completedSessions,
    required this.streakDays,
    this.insight = '',
  });

  /// Parses the relevant fields out of the `/api/analytics/learner` payload.
  /// Returns `null` when the response is not the expected object shape, so the
  /// caller can hide the card rather than render fabricated zeroes.
  static CoachingSnapshot? fromAnalyticsJson(Object? json) {
    if (json is! Map<String, Object?>) return null;
    final totals = json['totals'];
    if (totals is! Map<String, Object?>) return null;
    final weakSkills = json['weakSkills'];
    return CoachingSnapshot(
      dueFlashcards: _int(json['dueFlashcards']),
      weakCount: weakSkills is List ? weakSkills.length : 0,
      accuracyPct: _int(totals['bjtAccuracyPct']),
      reviewCount: _int(totals['reviewCount']),
      completedSessions: _int(totals['completedBjtSessions']),
      streakDays: _int(totals['streakDays']),
      insight: _str(json['insight']),
    );
  }

  /// Due flashcards across the learner's decks.
  final int dueFlashcards;

  /// Number of weak BJT skills the backend flagged.
  final int weakCount;

  /// BJT accuracy as a whole percentage (0–100).
  final int accuracyPct;

  /// Recorded review events in the window.
  final int reviewCount;

  /// Completed BJT sessions in the window.
  final int completedSessions;

  /// Current study-day streak.
  final int streakDays;

  /// Server-derived, locale-aware coaching line. Empty when the backend
  /// returned no insight; the card hides the line rather than inventing one.
  final String insight;

  /// `true` when there is enough real signal to recommend anything.
  bool get hasSignal =>
      dueFlashcards > 0 ||
      weakCount > 0 ||
      reviewCount > 0 ||
      completedSessions > 0 ||
      streakDays > 0;

  int get _activity => reviewCount + completedSessions;

  /// The recommended next action. Mirrors web `pickPrimaryAction`.
  CoachingAction get primaryAction {
    if (dueFlashcards >= 4) return CoachingAction.flashcards;
    if (weakCount >= 1 && dueFlashcards <= 2) return CoachingAction.quiz;
    if (accuracyPct < 62 && _activity >= 4) return CoachingAction.quiz;
    if (dueFlashcards >= 1) return CoachingAction.flashcards;
    return _activity < 2 ? CoachingAction.flashcards : CoachingAction.quiz;
  }

  /// The hint shown under the action. Mirrors web primary-hint selection.
  CoachingHint get primaryHint {
    if (primaryAction == CoachingAction.flashcards) {
      return dueFlashcards > 0
          ? CoachingHint.flashcardsDue
          : CoachingHint.maintain;
    }
    if (weakCount > 0) return CoachingHint.quizSkills;
    if (accuracyPct < 70) return CoachingHint.quizAccuracy;
    return CoachingHint.maintain;
  }

  /// The encouraging nudge line. Mirrors web `pickNudgeMessage`.
  CoachingNudge get nudge {
    if (dueFlashcards > 0) return CoachingNudge.due;
    if (weakCount > 0) return CoachingNudge.weak;
    if (streakDays >= 2) return CoachingNudge.streak;
    return CoachingNudge.calm;
  }

  static int _int(Object? value) {
    if (value is int) return value;
    if (value is num) return value.round();
    return 0;
  }

  static String _str(Object? value) => value is String ? value.trim() : '';
}
