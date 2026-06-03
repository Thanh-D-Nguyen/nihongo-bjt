import 'package:nihongo_bjt/core/api/repository_result.dart';
import 'package:nihongo_bjt/features/scenarios/domain/scenario_models.dart';

/// Safe JSON → domain mapping for the business-scenario API
/// (`/api/scenarios`). Defensive: tolerates missing/extra fields, never
/// fabricates data, and throws [RepositoryErrorKind.invalidResponse] on a
/// fundamentally wrong shape.
abstract final class ScenarioDto {
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

  static bool _bool(Object? v) {
    if (v is bool) return v;
    if (v is String) return v == 'true';
    return false;
  }

  static List<Map<String, dynamic>> _childList(Object? v) {
    if (v is List) return v.whereType<Map<String, dynamic>>().toList();
    return const [];
  }

  static ScenarioSummary summary(Map<String, dynamic> json) {
    final count = json['_count'];
    final counts = count is Map<String, dynamic>
        ? count
        : const <String, dynamic>{};
    return ScenarioSummary(
      id: _str(json['id']),
      slug: _str(json['slug']),
      titleVi: _str(json['titleVi']),
      titleJa: _strOrNull(json['titleJa']),
      descriptionVi: _strOrNull(json['descriptionVi']),
      difficulty: _str(json['difficulty'], 'intermediate'),
      category: _str(json['category'], 'email'),
      iconEmoji: _str(json['iconEmoji'], '💼'),
      estimatedMin: _int(json['estimatedMin'], 5),
      stepCount: _int(counts['steps']),
      attemptCount: _int(counts['attempts']),
    );
  }

  static ScenarioChoice choice(Map<String, dynamic> json) => ScenarioChoice(
    id: _str(json['id']),
    choiceKey: _str(json['choiceKey']),
    textVi: _str(json['textVi']),
    textJa: _strOrNull(json['textJa']),
  );

  static ScenarioStep step(Map<String, dynamic> json) => ScenarioStep(
    id: _str(json['id']),
    stepOrder: _int(json['stepOrder']),
    situationVi: _str(json['situationVi']),
    situationJa: _strOrNull(json['situationJa']),
    speakerName: _strOrNull(json['speakerName']),
    speakerRole: _strOrNull(json['speakerRole']),
    choices: _childList(json['choices']).map(choice).toList(),
  );

  static ScenarioDetail detail(Map<String, dynamic> json) => ScenarioDetail(
    id: _str(json['id']),
    slug: _str(json['slug']),
    titleVi: _str(json['titleVi']),
    titleJa: _strOrNull(json['titleJa']),
    descriptionVi: _strOrNull(json['descriptionVi']),
    difficulty: _str(json['difficulty'], 'intermediate'),
    category: _str(json['category'], 'email'),
    iconEmoji: _str(json['iconEmoji'], '💼'),
    estimatedMin: _int(json['estimatedMin'], 5),
    steps: _childList(json['steps']).map(step).toList(),
  );

  static ScenarioChoiceFeedback feedback(Map<String, dynamic> json) =>
      ScenarioChoiceFeedback(
        choiceKey: _str(json['choiceKey']),
        isOptimal: _bool(json['isOptimal']),
        pointsAwarded: _int(json['pointsAwarded']),
        feedbackVi: _strOrNull(json['feedbackVi']),
      );

  static ScenarioResult result(Map<String, dynamic> json) => ScenarioResult(
    id: _str(json['id']),
    totalPoints: _int(json['totalPoints']),
    maxPoints: _int(json['maxPoints']),
  );
}
