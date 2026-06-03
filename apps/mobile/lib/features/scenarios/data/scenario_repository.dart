import 'package:nihongo_bjt/core/api/api_client.dart';
import 'package:nihongo_bjt/core/api/api_query.dart';
import 'package:nihongo_bjt/core/api/repository_result.dart';
import 'package:nihongo_bjt/features/scenarios/data/scenario_dto.dart';
import 'package:nihongo_bjt/features/scenarios/domain/scenario_models.dart';

/// Access to the business-scenario API (`/api/scenarios`). All endpoints
/// require an authenticated learner; the shared auth-aware [ApiClient] attaches
/// the bearer token and the server resolves the learner id from the verified
/// token. All failures normalize to [RepositoryException]; no data is
/// fabricated and answer feedback is only ever returned by the server.
class ScenarioRepository {
  const ScenarioRepository(this._client);

  final ApiClient _client;

  /// Lists published scenarios, optionally filtered by [category].
  Future<List<ScenarioSummary>> listScenarios({String? category}) async {
    final c = category?.trim();
    final json = await guardApiCall(
      () => _client.getJson(
        '/api/scenarios${buildQuery({'category': c == null || c.isEmpty ? null : c})}',
      ),
    );
    return ScenarioDto.asMapList(json).map(ScenarioDto.summary).toList();
  }

  /// Full scenario with ordered steps and choices (no answer key).
  Future<ScenarioDetail> scenario(String id) async {
    final json = await guardApiCall(
      () => _client.getJson('/api/scenarios/$id'),
    );
    return ScenarioDto.detail(ScenarioDto.asMap(json));
  }

  /// Submits a choice for a step and returns the server's feedback.
  Future<ScenarioChoiceFeedback> submitChoice({
    required String stepId,
    required String choiceKey,
  }) async {
    final json = await guardApiCall(
      () => _client.postJson(
        '/api/scenarios/steps/$stepId/answer',
        body: {'choiceKey': choiceKey},
      ),
    );
    return ScenarioDto.feedback(ScenarioDto.asMap(json));
  }

  /// Completes a scenario attempt and returns the saved result.
  Future<ScenarioResult> complete({
    required String scenarioId,
    required List<ScenarioAnswer> answers,
  }) async {
    final json = await guardApiCall(
      () => _client.postJson(
        '/api/scenarios/$scenarioId/complete',
        body: {'choices': answers.map((a) => a.toJson()).toList()},
      ),
    );
    return ScenarioDto.result(ScenarioDto.asMap(json));
  }

  /// Recent attempts for a scenario (most recent first).
  Future<List<ScenarioResult>> attempts(String scenarioId) async {
    final json = await guardApiCall(
      () => _client.getJson('/api/scenarios/$scenarioId/attempts'),
    );
    return ScenarioDto.asMapList(json).map(ScenarioDto.result).toList();
  }
}
