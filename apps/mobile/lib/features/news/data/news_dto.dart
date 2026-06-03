import 'package:nihongo_bjt/core/api/repository_result.dart';
import 'package:nihongo_bjt/features/news/domain/news_models.dart';

/// Safe JSON → domain mapping for the NHK news API (`/api/nhk-news`).
/// Defensive: tolerates missing/extra fields, never fabricates data, and
/// throws [RepositoryErrorKind.invalidResponse] on a fundamentally wrong shape.
abstract final class NewsDto {
  static List<Map<String, dynamic>> asMapList(Object? json) {
    if (json is List) {
      return json.whereType<Map<String, dynamic>>().toList();
    }
    throw const RepositoryException(RepositoryErrorKind.invalidResponse);
  }

  static Map<String, dynamic> asMap(Object? json) {
    if (json is Map<String, dynamic>) return json;
    throw const RepositoryException(RepositoryErrorKind.invalidResponse);
  }

  static String _str(Object? v, [String fallback = '']) =>
      v is String ? v : (v?.toString() ?? fallback);

  static String? _strOrNull(Object? v) {
    if (v == null) return null;
    final s = v is String ? v : v.toString();
    return s.isEmpty ? null : s;
  }

  static DateTime? _dateOrNull(Object? v) {
    if (v is! String || v.isEmpty) return null;
    return DateTime.tryParse(v);
  }

  static List<Map<String, dynamic>> _childList(Object? v) {
    if (v is List) return v.whereType<Map<String, dynamic>>().toList();
    return const [];
  }

  static NewsArticleSummary summary(Map<String, dynamic> json) =>
      NewsArticleSummary(
        id: _str(json['id']),
        title: _str(json['title']),
        titleWithRuby: _strOrNull(json['titleWithRuby']),
        publishedAt: _dateOrNull(json['publishedAt']),
        imageUrl: _strOrNull(json['imageUrl']),
        difficulty: _strOrNull(json['difficulty']),
        url: _str(json['url']),
        sourceType: _str(json['sourceType'], 'normal'),
        sourceLabel: _str(json['sourceLabel'], 'NHK'),
      );

  static NewsVocabItem vocab(Map<String, dynamic> json) => NewsVocabItem(
    word: _str(json['word']),
    reading: _strOrNull(json['reading']),
    meaning: _strOrNull(json['meaning']),
    pos: _strOrNull(json['pos']),
  );

  static NewsArticleDetail detail(Map<String, dynamic> json) =>
      NewsArticleDetail(
        summary: summary(json),
        audioUrl: _strOrNull(json['audioUrl']),
        bodyHtml: _str(json['bodyHtml']),
        bodyPlain: _str(json['bodyPlain']),
        vocabulary: _childList(json['vocabulary']).map(vocab).toList(),
      );
}
