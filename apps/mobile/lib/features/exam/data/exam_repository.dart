import 'package:nihongo_bjt/core/api/api_client.dart';
import 'package:nihongo_bjt/core/api/repository_result.dart';
import 'package:nihongo_bjt/features/exam/data/exam_dto.dart';
import 'package:nihongo_bjt/features/exam/domain/exam_models.dart';

/// Access to the BJT quiz/exam API (`/api/quiz`). Templates are public; session
/// endpoints require an authenticated learner (the shared auth-aware
/// [ApiClient] attaches the bearer token and the server resolves the learner id
/// from it). All failures normalize to [RepositoryException]. Answer
/// correctness is never returned mid-session — the server enforces this.
class ExamRepository {
  const ExamRepository(this._client);

  final ApiClient _client;

  /// Lists published BJT mock-test templates.
  Future<List<ExamTemplate>> listTemplates() async {
    final json = await guardApiCall(
      () => _client.getJson('/api/quiz/templates'),
    );
    return ExamDto.asMapList(json).map(ExamDto.template).toList();
  }

  /// Starts a scored session for [testId] (quota- and entitlement-gated).
  Future<ExamSession> startSession(String testId) async {
    final json = await guardApiCall(
      () => _client.postJson('/api/quiz/start', body: {'testId': testId}),
    );
    return ExamDto.session(ExamDto.asMap(json));
  }

  /// Fetches the current question + session state for an active session.
  Future<ExamCurrentQuestion> currentQuestion(String sessionId) async {
    final json = await guardApiCall(
      () => _client.getJson('/api/quiz/session/$sessionId/question'),
    );
    return ExamDto.currentQuestion(ExamDto.asMap(json));
  }

  /// Submits an answer and returns the updated session (no correctness leak).
  Future<ExamSession> submitAnswer({
    required String sessionId,
    required String questionId,
    required String optionKey,
  }) async {
    final json = await guardApiCall(
      () => _client.postJson(
        '/api/quiz/session/$sessionId/answer',
        body: {'questionId': questionId, 'optionKey': optionKey},
      ),
    );
    final map = ExamDto.asMap(json);
    return ExamDto.session(ExamDto.asMap(map['session']));
  }
}
