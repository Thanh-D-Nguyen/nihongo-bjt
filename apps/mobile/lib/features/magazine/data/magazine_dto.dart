import 'package:nihongo_bjt/core/api/repository_result.dart';
import 'package:nihongo_bjt/features/magazine/domain/magazine_models.dart';

/// Safe JSON → domain mapping for the magazine API (`/api/magazine`).
/// Defensive: tolerates missing/extra fields, never fabricates data, and
/// throws [RepositoryErrorKind.invalidResponse] on a fundamentally wrong shape.
abstract final class MagazineDto {
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

  /// Unwraps the `{ data, total, page, limit }` list envelope or accepts a
  /// bare list.
  static List<Map<String, dynamic>> asListEnvelope(Object? json) {
    if (json is List) {
      return json.whereType<Map<String, dynamic>>().toList();
    }
    if (json is Map<String, dynamic> && json['data'] is List) {
      return (json['data'] as List)
          .whereType<Map<String, dynamic>>()
          .toList();
    }
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

  static List<String> _stringList(Object? v) {
    if (v is List) {
      return v.map((e) => e?.toString() ?? '').where((s) => s.isNotEmpty)
          .toList();
    }
    return const [];
  }

  static List<Map<String, dynamic>> _childList(Object? v) {
    if (v is List) return v.whereType<Map<String, dynamic>>().toList();
    return const [];
  }

  static MagazineVocab vocab(Map<String, dynamic> json) => MagazineVocab(
    word: _str(json['word']),
    reading: _strOrNull(json['reading']),
    meaning: _strOrNull(json['meaning']),
  );

  static MagazineQuizOption quizOption(Map<String, dynamic> json) =>
      MagazineQuizOption(
        label: _str(json['label']),
        isCorrect: json['isCorrect'] == true,
      );

  static MagazineQuiz quiz(Map<String, dynamic> json) => MagazineQuiz(
    questionJp: _str(json['questionJp']),
    questionVi: _strOrNull(json['questionVi']),
    options: _childList(json['options']).map(quizOption).toList(),
    explanationJp: _strOrNull(json['explanationJp']),
    explanationVi: _strOrNull(json['explanationVi']),
  );

  static MagazineArticle article(Map<String, dynamic> json) {
    final content = json['contentJson'];
    final contentMap = content is Map<String, dynamic>
        ? content
        : const <String, dynamic>{};
    return MagazineArticle(
      slug: _str(json['slug']),
      widgetKind: _str(json['widgetKind']),
      titleJp: _str(json['titleJp']),
      titleVi: _str(json['titleVi']),
      summaryJp: _strOrNull(json['summaryJp']),
      summaryVi: _strOrNull(json['summaryVi']),
      coverImageUrl: _strOrNull(json['coverImageUrl']),
      jlptLevel: _strOrNull(json['jlptLevel']),
      publishDate: _dateOrNull(json['publishDate']),
      paragraphsJp: _stringList(contentMap['paragraphsJp']),
      paragraphsVi: _stringList(contentMap['paragraphsVi']),
      vocab: _childList(json['vocabWords']).map(vocab).toList(),
      quizzes: _childList(json['quizzes']).map(quiz).toList(),
    );
  }
}
