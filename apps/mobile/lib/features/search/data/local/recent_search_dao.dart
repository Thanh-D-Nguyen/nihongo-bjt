import 'package:drift/drift.dart';
import 'package:nihongo_bjt/core/database/app_database.dart';
import 'package:nihongo_bjt/features/search/data/local/recent_search_table.dart';

part 'recent_search_dao.g.dart';

/// Data-access object for the device-scoped [RecentSearches] history store.
///
/// Pure persistence: record / list / remove / clear over query strings. The
/// list is capped to [maxEntries] most-recent items so history never grows
/// unbounded (matching the web app's 8-item cap, slightly larger for mobile).
@DriftAccessor(tables: [RecentSearches])
class RecentSearchDao extends DatabaseAccessor<AppDatabase>
    with _$RecentSearchDaoMixin {
  RecentSearchDao(super.attachedDatabase);

  /// Maximum number of recent queries kept on device.
  static const int maxEntries = 10;

  /// Records [query] as the most-recent search (idempotent: re-searching the
  /// same text refreshes its timestamp instead of duplicating). Blank queries
  /// are ignored. Trims history back down to [maxEntries] after each write.
  Future<void> record(String query) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) return;

    await into(recentSearches).insertOnConflictUpdate(
      RecentSearchesCompanion.insert(
        query: trimmed,
        searchedAtMicros: DateTime.now().microsecondsSinceEpoch,
      ),
    );
    await _trim();
  }

  /// Lists recent queries, most-recent first, capped to [maxEntries].
  Future<List<String>> list() async {
    final rows =
        await (select(recentSearches)
              ..orderBy([(t) => OrderingTerm.desc(t.searchedAtMicros)])
              ..limit(maxEntries))
            .get();
    return rows.map((row) => row.query).toList();
  }

  /// Watches recent queries, most-recent first, capped to [maxEntries].
  Stream<List<String>> watch() {
    final query =
        select(recentSearches)
          ..orderBy([(t) => OrderingTerm.desc(t.searchedAtMicros)])
          ..limit(maxEntries);
    return query.watch().map((rows) => rows.map((row) => row.query).toList());
  }

  /// Removes a single [query] from history (no-op when absent).
  Future<void> remove(String query) async {
    await (delete(
      recentSearches,
    )..where((t) => t.query.equals(query.trim()))).go();
  }

  /// Clears all recent searches.
  Future<void> clear() async {
    await delete(recentSearches).go();
  }

  /// Keeps only the [maxEntries] most-recent rows, deleting older overflow.
  Future<void> _trim() async {
    final keep =
        await (select(recentSearches)
              ..orderBy([(t) => OrderingTerm.desc(t.searchedAtMicros)])
              ..limit(maxEntries))
            .get();
    if (keep.length < maxEntries) return;
    final cutoff = keep.last.searchedAtMicros;
    await (delete(
      recentSearches,
    )..where((t) => t.searchedAtMicros.isSmallerThanValue(cutoff))).go();
  }
}
