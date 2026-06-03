import 'package:nihongo_bjt/core/api/repository_result.dart';
import 'package:nihongo_bjt/core/content/domain/content_models.dart';

/// Safe JSON → domain mapping for the canonical content API.
///
/// Every parser is defensive: missing/extra fields are tolerated, type
/// mismatches fall back to null/empty, and a fundamentally wrong shape (e.g. a
/// non-list where a list is required) throws
/// [RepositoryErrorKind.invalidResponse] rather than corrupting the UI. No
/// data is fabricated.
abstract final class ContentDto {
  /// Casts a decoded JSON value to a list of maps, or throws
  /// invalidResponse.
  static List<Map<String, dynamic>> asMapList(Object? json) {
    if (json is List) {
      return json.whereType<Map<String, dynamic>>().toList();
    }
    throw const RepositoryException(RepositoryErrorKind.invalidResponse);
  }

  /// Casts a decoded JSON value to a map, or throws invalidResponse.
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

  static int _int(Object? v, [int fallback = 0]) {
    if (v is int) return v;
    if (v is num) return v.toInt();
    if (v is String) return int.tryParse(v) ?? fallback;
    return fallback;
  }

  static int? _intOrNull(Object? v) {
    if (v is int) return v;
    if (v is num) return v.toInt();
    if (v is String) return int.tryParse(v);
    return null;
  }

  static List<Map<String, dynamic>> _childList(Object? v) {
    if (v is List) return v.whereType<Map<String, dynamic>>().toList();
    return const [];
  }

  // --- Examples -------------------------------------------------------------

  static ContentExample example(Map<String, dynamic> json) => ContentExample(
    id: _str(json['id']),
    japaneseText: _str(json['japaneseText']),
    reading: _strOrNull(json['reading']),
    translationVi: _strOrNull(json['translationVi']),
  );

  /// Pulls the nested `exampleSentence` out of a sense/detail example link.
  static ContentExample? exampleFromLink(Map<String, dynamic> link) {
    final nested = link['exampleSentence'];
    if (nested is Map<String, dynamic>) return example(nested);
    return null;
  }

  // --- Dictionary -----------------------------------------------------------

  static LexemeSense sense(Map<String, dynamic> json) => LexemeSense(
    id: _str(json['id']),
    position: _int(json['position']),
    meaningVi: _str(json['meaningVi']),
    partOfSpeech: _strOrNull(json['partOfSpeech']),
    examples: _childList(json['exampleLinks'])
        .map(exampleFromLink)
        .whereType<ContentExample>()
        .toList(),
  );

  static Lexeme lexeme(Map<String, dynamic> json) => Lexeme(
    id: _str(json['id']),
    headword: _str(json['headword']),
    reading: _strOrNull(json['reading']),
    jlptLevel: _strOrNull(json['jlptLevel']),
    shortMeaningVi: _strOrNull(json['shortMeaningVi']),
    kanjiMeaningVi: _strOrNull(json['kanjiMeaningVi']),
    senses: _childList(json['senses']).map(sense).toList(),
  );

  // --- Kanji ----------------------------------------------------------------

  static KanjiComponent kanjiComponent(Map<String, dynamic> json) =>
      KanjiComponent(
        id: _str(json['id']),
        position: _int(json['position']),
        character: _str(json['character']),
        hanViet: _strOrNull(json['hanViet']),
      );

  static KanjiExample kanjiExample(Map<String, dynamic> json) => KanjiExample(
    id: _str(json['id']),
    position: _int(json['position']),
    word: _str(json['word']),
    reading: _strOrNull(json['reading']),
    meaningVi: _strOrNull(json['meaningVi']),
    hanViet: _strOrNull(json['hanViet']),
  );

  static KanjiEntry kanji(Map<String, dynamic> json) => KanjiEntry(
    id: _str(json['id']),
    character: _str(json['character']),
    meaningVi: _strOrNull(json['meaningVi']),
    onyomi: _strOrNull(json['onyomi']),
    kunyomi: _strOrNull(json['kunyomi']),
    strokeCount: _intOrNull(json['strokeCount']),
    level: _intOrNull(json['level']),
    frequency: _intOrNull(json['frequency']),
    detail: _strOrNull(json['detail']),
    tip: _strOrNull(json['tip']),
    hasStrokeDiagram: _strOrNull(json['strokeSvgPath']) != null,
    components: _childList(json['components']).map(kanjiComponent).toList(),
    examples: _childList(json['examples']).map(kanjiExample).toList(),
  );

  // --- Grammar --------------------------------------------------------------

  static GrammarDetail grammarDetail(Map<String, dynamic> json) =>
      GrammarDetail(
        id: _str(json['id']),
        position: _int(json['position']),
        meaningVi: _strOrNull(json['meaningVi']),
        explanation: _strOrNull(json['explanation']),
        note: _strOrNull(json['note']),
        synopsis: _strOrNull(json['synopsis']),
        examples: _childList(json['exampleLinks'])
            .map(exampleFromLink)
            .whereType<ContentExample>()
            .toList(),
      );

  static GrammarEntry grammar(Map<String, dynamic> json) => GrammarEntry(
    id: _str(json['id']),
    pattern: _str(json['pattern']),
    meaningVi: _str(json['meaningVi']),
    jlptLevel: _strOrNull(json['jlptLevel']),
    category: _strOrNull(json['category']),
    details: _childList(json['details']).map(grammarDetail).toList(),
  );

  // --- Search ---------------------------------------------------------------

  static SearchHitKind _hitKind(Object? v) => switch (_str(v)) {
    'lexeme' => SearchHitKind.lexeme,
    'kanji' => SearchHitKind.kanji,
    'grammar' => SearchHitKind.grammar,
    'example' => SearchHitKind.example,
    _ => SearchHitKind.unknown,
  };

  static SearchHit searchHit(Map<String, dynamic> json) => SearchHit(
    id: _str(json['id']),
    kind: _hitKind(json['kind']),
    title: _str(json['title']),
    reading: _strOrNull(json['reading']),
    description: _strOrNull(json['description']),
    jlptLevel: _strOrNull(json['jlptLevel']),
  );
}
