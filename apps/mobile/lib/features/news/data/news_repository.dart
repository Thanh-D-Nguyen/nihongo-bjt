import 'package:nihongo_bjt/core/api/api_client.dart';
import 'package:nihongo_bjt/core/api/api_query.dart';
import 'package:nihongo_bjt/core/api/repository_result.dart';
import 'package:nihongo_bjt/features/news/data/news_dto.dart';
import 'package:nihongo_bjt/features/news/domain/news_models.dart';

/// Access to the NHK news API (`/api/nhk-news`). Listing and detail are public;
/// bookmark + reading-progress endpoints require an authenticated learner (the
/// shared auth-aware [ApiClient] attaches the bearer token). All failures
/// normalize to [RepositoryException]; no data is fabricated.
class NewsRepository {
  const NewsRepository(this._client);

  final ApiClient _client;

  /// Lists recent NHK articles. [type] is `easy` or `normal`; [locale] is
  /// `vi` or `ja`.
  Future<List<NewsArticleSummary>> listArticles({
    String? type,
    String locale = 'vi',
    int limit = 20,
    int offset = 0,
  }) async {
    final query = buildQuery({
      'type': type == null || type.isEmpty ? null : type,
      'locale': locale,
      'limit': '$limit',
      'offset': '$offset',
    });
    final json = await guardApiCall(
      () => _client.getJson('/api/nhk-news$query'),
    );
    return NewsDto.asMapList(json).map(NewsDto.summary).toList();
  }

  /// Full article detail with body and extracted vocabulary.
  Future<NewsArticleDetail> article(String id) async {
    final json = await guardApiCall(
      () => _client.getJson('/api/nhk-news/$id'),
    );
    return NewsDto.detail(NewsDto.asMap(json));
  }

  /// Toggles the bookmark for an article and returns the new state.
  Future<bool> toggleBookmark(String id) async {
    final json = await guardApiCall(
      () => _client.postJson('/api/nhk-news/$id/bookmark'),
    );
    final map = NewsDto.asMap(json);
    final value = map['bookmarked'];
    return value is bool && value;
  }

  /// Lists the learner's bookmarked articles.
  Future<List<NewsArticleSummary>> bookmarks({
    int limit = 20,
    int offset = 0,
  }) async {
    final query = buildQuery({'limit': '$limit', 'offset': '$offset'});
    final json = await guardApiCall(
      () => _client.getJson('/api/nhk-news/bookmarks$query'),
    );
    return NewsDto.asMapList(json).map(NewsDto.summary).toList();
  }

  /// Tracks reading progress for an article.
  Future<void> trackReading({
    required String id,
    int? readTimeSec,
    bool? completed,
  }) async {
    await guardApiCall(
      () => _client.postJson(
        '/api/nhk-news/$id/reading',
        body: {
          'readTimeSec': ?readTimeSec,
          'completed': ?completed,
        },
      ),
    );
  }
}
