/// Immutable snapshot backing the home Learning Dashboard.
///
/// Every field is derived from a real data source (the flashcard repository and
/// the offline review queue). No fabricated metrics live here: numbers the app
/// has no real source for (streaks, SRS due-today scheduling) are intentionally
/// absent rather than guessed.
class HomeDashboardData {
  const HomeDashboardData({
    required this.deckCount,
    required this.totalCardCount,
    this.pendingSyncCount,
  });

  /// Number of decks available to the learner (`fetchDecks().length`).
  final int deckCount;

  /// Total cards across all decks (sum of each deck's `cardCount`). This is the
  /// real pool of cards the learner can review right now.
  final int totalCardCount;

  /// Reviews queued offline awaiting manual sync, or `null` when sync does not
  /// apply (mock data source has no queue). Never fabricated.
  final int? pendingSyncCount;

  /// Whether the learner has any deck to study.
  bool get hasDecks => deckCount > 0;

  /// Whether an offline sync status is available to display.
  bool get hasSyncStatus => pendingSyncCount != null;
}
