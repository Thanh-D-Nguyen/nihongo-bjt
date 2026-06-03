import 'package:nihongo_bjt/core/api/api_client.dart';
import 'package:nihongo_bjt/core/api/api_query.dart';
import 'package:nihongo_bjt/core/api/repository_result.dart';
import 'package:nihongo_bjt/features/magazine/data/magazine_dto.dart';
import 'package:nihongo_bjt/features/magazine/domain/magazine_models.dart';

/// Access to the magazine API (`/api/magazine`). Listing and detail are
/// public; marking an article read requires an authenticated learner (the
/// shared auth-aware [ApiClient] attaches the bearer token). All failures
/// normalize to [RepositoryException]; no data is fabricated.
class MagazineRepository {
  const MagazineRepository(this._client);

  final ApiClient _client;

  /// Lists published magazine articles. [widgetKind] is a filter key such as
  /// `vocab`, `weather`, `horoscope`, `bjt_phrase` (or `all`/null for every
  /// kind).
  Future<List<MagazineArticle>> list({
    String? widgetKind,
    String locale = 'vi',
    int page = 1,
    int limit = 20,
  }) async {
    final query = buildQuery({
      'widgetKind': widgetKind == null || widgetKind.isEmpty
          ? null
          : widgetKind,
      'locale': locale,
      'page': '$page',
      'limit': '$limit',
    });
    final json = await guardApiCall(
      () => _client.getJson('/api/magazine$query'),
    );
    return MagazineDto.asListEnvelope(json)
        .map(MagazineDto.article)
        .toList();
  }

  /// Today's magazine articles across all widget kinds.
  Future<List<MagazineArticle>> today({String locale = 'vi'}) async {
    final query = buildQuery({'locale': locale});
    final json = await guardApiCall(
      () => _client.getJson('/api/magazine/today$query'),
    );
    return MagazineDto.asMapList(json).map(MagazineDto.article).toList();
  }

  /// Full article detail by slug.
  Future<MagazineArticle> article(String slug) async {
    final json = await guardApiCall(
      () => _client.getJson('/api/magazine/$slug'),
    );
    return MagazineDto.article(MagazineDto.asMap(json));
  }

  /// Marks an article read and submits quiz results. No-op for anonymous
  /// learners (the backend returns `{ ok: false }`).
  Future<void> markRead({
    required String slug,
    int? quizScore,
    int? quizTotal,
    int? timeSpentSeconds,
  }) async {
    await guardApiCall(
      () => _client.postJson(
        '/api/magazine/$slug/read',
        body: {
          'quizScore': ?quizScore,
          'quizTotal': ?quizTotal,
          'timeSpentSeconds': ?timeSpentSeconds,
        },
      ),
    );
  }
}
