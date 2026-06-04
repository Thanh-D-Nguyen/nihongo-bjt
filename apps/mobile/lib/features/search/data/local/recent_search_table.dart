import 'package:drift/drift.dart';

/// Drift table holding the learner's recent search queries (Search hub).
///
/// Device-scoped history only — this mirrors the web app's `localStorage`
/// recent-search behaviour (`nihongo-bjt:recent-searches`). There is no backend
/// search-history contract, so nothing is synced and nothing is fabricated.
/// The query text itself is the primary key, so re-running a search updates its
/// timestamp instead of creating a duplicate row.
@DataClassName('RecentSearchRow')
class RecentSearches extends Table {
  /// The trimmed query text the learner searched for.
  TextColumn get query => text()();

  /// When the query was last issued, as microseconds since epoch. Stored as an
  /// integer (not a Drift `dateTime`, which truncates to whole seconds) so
  /// rapid successive searches keep a stable most-recent-first order.
  IntColumn get searchedAtMicros => integer()();

  @override
  Set<Column<Object>> get primaryKey => {query};
}
