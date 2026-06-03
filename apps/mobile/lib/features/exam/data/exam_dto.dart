import 'package:nihongo_bjt/core/api/repository_result.dart';
import 'package:nihongo_bjt/features/exam/domain/exam_models.dart';

/// Safe JSON → domain mapping for the BJT quiz/exam API (`/api/quiz`).
/// Defensive: tolerates missing/extra fields, never fabricates data, and throws
/// [RepositoryErrorKind.invalidResponse] on a fundamentally wrong shape.
abstract final class ExamDto {
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

  static ExamTemplate template(Map<String, dynamic> json) {
    final count = json['_count'];
    final counts = count is Map<String, dynamic>
        ? count
        : const <String, dynamic>{};
    return ExamTemplate(
      id: _str(json['id']),
      slug: _str(json['slug']),
      titleVi: _str(json['titleVi']),
      titleJa: _strOrNull(json['titleJa']),
      type: _str(json['type'], 'practice'),
      level: _strOrNull(json['level']),
      description: _strOrNull(json['description']),
      timeLimitSeconds: _intOrNull(json['timeLimitSeconds']),
      sectionCount: _int(counts['sections']),
      sessionCount: _int(counts['sessions']),
    );
  }

  static ExamOption option(Map<String, dynamic> json) => ExamOption(
    id: _str(json['id']),
    optionKey: _str(json['optionKey']),
    text: _str(json['text']),
  );

  static ExamQuestion question(Map<String, dynamic> json) => ExamQuestion(
    id: _str(json['id']),
    prompt: _str(json['prompt']),
    scenario: _strOrNull(json['scenario']),
    sectionCode: _strOrNull(json['sectionCode']),
    skillTag: _strOrNull(json['skillTag']),
    difficulty: _strOrNull(json['difficulty']),
    audioUrl: _strOrNull(json['audioUrl']),
    imageUrl: _strOrNull(json['imageUrl']),
    imageAlt: _strOrNull(json['imageAlt']),
    options: _childList(json['options']).map(option).toList(),
  );

  static ExamSession session(Map<String, dynamic> json) => ExamSession(
    id: _str(json['id']),
    status: _str(json['status'], 'in_progress'),
    currentQuestionNo: _int(json['currentQuestionNo']),
    totalQuestions: _int(json['totalQuestions']),
    correctCount: _int(json['correctCount']),
    remainingSeconds: _intOrNull(json['remainingSeconds']),
    timeLimitSeconds: _intOrNull(json['timeLimitSeconds']),
    estimatedScore: _intOrNull(json['estimatedScore']),
    estimatedBjtBand: _strOrNull(json['estimatedBjtBand']),
  );

  static ExamCurrentQuestion currentQuestion(Map<String, dynamic> json) {
    final q = json['question'];
    return ExamCurrentQuestion(
      question: q is Map<String, dynamic> ? question(q) : null,
      session: session(asMap(json['session'])),
    );
  }
}
