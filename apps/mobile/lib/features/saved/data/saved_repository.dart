import 'package:nihongo_bjt/core/api/api_client.dart';
import 'package:nihongo_bjt/core/api/api_query.dart';
import 'package:nihongo_bjt/core/api/repository_result.dart';
import 'package:nihongo_bjt/features/saved/data/saved_dto.dart';
import 'package:nihongo_bjt/features/saved/domain/saved_models.dart';

/// Read/write access to the learner's saved bookmarks (`/api/bookmarks/*`).
///
/// These endpoints require an authenticated session: the shared [ApiClient]
/// attaches the bearer token, so no `userId` is ever sent from the client.
/// Failures are normalized to [RepositoryException]; the repository never
/// fabricates saved items.
class SavedRepository {
  const SavedRepository(this._client);

  final ApiClient _client;

  static const int _listLimit = 50;

  /// Lists the learner's bookmarks for a given [kind], newest first.
  Future<List<BookmarkItem>> list(BookmarkKind kind) async {
    final json = await guardApiCall(
      () => _client.getJson(
        '/api/bookmarks/${kind.listSegment}'
        '${buildQuery({'limit': _listLimit})}',
      ),
    );
    return SavedDto.items(json).map(SavedDto.item).toList();
  }

  /// Toggles a bookmark for [targetId]. Returns the resulting bookmarked state.
  Future<bool> toggle(BookmarkKind kind, String targetId) async {
    final json = await guardApiCall(
      () => _client.postJson('/api/bookmarks/${kind.toggleType}/$targetId'),
    );
    return SavedDto.bookmarked(json);
  }
}
