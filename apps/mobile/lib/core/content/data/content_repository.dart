import 'package:nihongo_bjt/core/api/api_client.dart';
import 'package:nihongo_bjt/core/api/api_query.dart';
import 'package:nihongo_bjt/core/api/repository_result.dart';
import 'package:nihongo_bjt/core/content/data/content_dto.dart';
import 'package:nihongo_bjt/core/content/domain/content_models.dart';

/// Read access to the canonical content API (Dictionary, Kanji, Grammar,
/// Search). These endpoints are public (no auth required); the shared
/// [ApiClient] still attaches a bearer token when present, which the server
/// ignores. All failures are normalized to [RepositoryException] — the
/// repository never returns fabricated content.
class ContentRepository {
  const ContentRepository(this._client);

  final ApiClient _client;

  // Endpoint caps from the backend schemas (searchQuerySchema/pagination).
  static const int _searchLimit = 20;
  static const int _listLimit = 30;

  /// JP→VI dictionary search. Empty [query] returns an empty list (the search
  /// box requires input before hitting the network).
  Future<List<Lexeme>> searchDictionary(String query) async {
    final q = query.trim();
    if (q.isEmpty) return const [];
    final json = await guardApiCall(
      () => _client.getJson(
        '/api/dictionary/search${buildQuery({'q': q, 'limit': _searchLimit})}',
      ),
    );
    return ContentDto.asMapList(json).map(ContentDto.lexeme).toList();
  }

  /// Full dictionary word detail (senses + linked examples).
  Future<Lexeme> dictionaryWord(String id) async {
    final json = await guardApiCall(
      () => _client.getJson('/api/dictionary/words/$id'),
    );
    return ContentDto.lexeme(ContentDto.asMap(json));
  }

  /// Kanji list (optionally filtered by [query]: a character, reading or
  /// level).
  Future<List<KanjiEntry>> listKanji({String? query, int offset = 0}) async {
    final cursor = PageCursor(limit: _listLimit, offset: offset);
    final json = await guardApiCall(
      () => _client.getJson(
        '/api/kanji${buildQuery(cursor.toQuery({'q': query?.trim()}))}',
      ),
    );
    return ContentDto.asMapList(json).map(ContentDto.kanji).toList();
  }

  /// Full kanji detail (readings, components, examples).
  Future<KanjiEntry> kanji(String id) async {
    final json = await guardApiCall(() => _client.getJson('/api/kanji/$id'));
    return ContentDto.kanji(ContentDto.asMap(json));
  }

  /// Absolute URL of a kanji's stroke-order SVG (same-origin server route).
  String kanjiStrokeUrl(String id) => '/api/kanji/$id/stroke';

  /// Grammar list (optionally filtered by [query]: a pattern or level).
  Future<List<GrammarEntry>> listGrammar({
    String? query,
    int offset = 0,
  }) async {
    final cursor = PageCursor(limit: _listLimit, offset: offset);
    final json = await guardApiCall(
      () => _client.getJson(
        '/api/grammar${buildQuery(cursor.toQuery({'q': query?.trim()}))}',
      ),
    );
    return ContentDto.asMapList(json).map(ContentDto.grammar).toList();
  }

  /// Full grammar point detail (pattern, meaning, explanations, examples).
  Future<GrammarEntry> grammar(String id) async {
    final json = await guardApiCall(() => _client.getJson('/api/grammar/$id'));
    return ContentDto.grammar(ContentDto.asMap(json));
  }

  /// Meilisearch-backed global content search. Returns typed hits routed by
  /// [SearchHit.kind]. Empty [query] returns an empty list.
  Future<List<SearchHit>> search(String query) async {
    final q = query.trim();
    if (q.isEmpty) return const [];
    final json = await guardApiCall(
      () => _client.getJson(
        '/api/search${buildQuery({'q': q, 'limit': _searchLimit})}',
      ),
    );
    final results = _resultsField(json);
    return ContentDto.asMapList(results).map(ContentDto.searchHit).toList();
  }

  /// The `/search` endpoint wraps hits in `{ results: [...] }`; tolerate both a
  /// wrapped object and a bare list.
  Object? _resultsField(Object? json) {
    if (json is Map<String, dynamic>) return json['results'];
    return json;
  }
}
