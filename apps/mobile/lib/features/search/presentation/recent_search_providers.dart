import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nihongo_bjt/core/database/database_provider.dart';
import 'package:nihongo_bjt/features/search/data/local/recent_search_dao.dart';

/// Riverpod wiring for the device-scoped recent-search history (Search hub).
///
/// History is local-only (Drift), mirroring the web app's `localStorage`
/// behaviour. No backend search-history contract exists, so nothing is synced
/// and nothing is fabricated.

// The stream provider exposes a verbose generated type; the name documents it.
// ignore_for_file: specify_nonobvious_property_types

/// Live list of the learner's recent queries, most-recent first (capped to
/// [RecentSearchDao.maxEntries]). Emits `[]` when there is no history.
final recentSearchesProvider = StreamProvider.autoDispose<List<String>>((ref) {
  return ref.watch(recentSearchDaoProvider).watch();
});

/// Imperative actions over the recent-search history.
final recentSearchControllerProvider = Provider<RecentSearchController>((ref) {
  return RecentSearchController(ref.watch(recentSearchDaoProvider));
});

/// Thin command object over [RecentSearchDao]. Holds no state of its own; the
/// UI reads history via [recentSearchesProvider].
class RecentSearchController {
  const RecentSearchController(this._dao);

  final RecentSearchDao _dao;

  /// Records a submitted query (blank/whitespace ignored, de-duplicated).
  Future<void> record(String query) => _dao.record(query);

  /// Removes a single query from history.
  Future<void> remove(String query) => _dao.remove(query);

  /// Clears all recent searches.
  Future<void> clear() => _dao.clear();
}
