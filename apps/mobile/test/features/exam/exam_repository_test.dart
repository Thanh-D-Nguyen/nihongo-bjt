import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nihongo_bjt/core/api/api_client.dart';
import 'package:nihongo_bjt/core/api/repository_result.dart';
import 'package:nihongo_bjt/core/config/app_environment.dart';
import 'package:nihongo_bjt/features/exam/data/exam_repository.dart';

void main() {
  const env = AppEnvironment(
    apiBaseUrl: 'https://api.test',
    keycloakIssuer: 'https://auth.test/realms/nihongo-bjt',
    oauthClientId: 'nihongo-mobile',
    oauthRedirectUri: 'com.nihongobjt.app://oauth2redirect',
    flashcardDataSource: 'api',
  );

  ExamRepository repositoryReturning(
    http.Response Function(http.Request request) handler, {
    String? token,
  }) {
    final client = ApiClient(
      environment: env,
      httpClient: MockClient((request) async => handler(request)),
      accessTokenProvider: token == null ? null : () async => token,
    );
    return ExamRepository(client);
  }

  // UTF-8 JSON so Japanese/Vietnamese survive the round-trip (bare
  // http.Response(String,...) uses Latin1).
  http.Response jsonOk(Object body) => http.Response.bytes(
    utf8.encode(jsonEncode(body)),
    200,
    headers: const {'content-type': 'application/json; charset=utf-8'},
  );

  group('listTemplates', () {
    test('maps the templates payload to the domain', () async {
      final repo = repositoryReturning(
        (request) {
          expect(request.method, 'GET');
          expect(request.url.path, '/api/quiz/templates');
          return jsonOk([
            {
              'id': 't1',
              'slug': 'bjt-official-1',
              'titleVi': 'Đề thi thử BJT chính thức',
              'titleJa': 'BJT 公式模擬',
              'type': 'official',
              'level': 'j2',
              'timeLimitSeconds': 1800,
              '_count': {'sections': 4, 'sessions': 2},
            },
          ]);
        },
      );

      final templates = await repo.listTemplates();

      expect(templates, hasLength(1));
      expect(templates.single.titleVi, 'Đề thi thử BJT chính thức');
      expect(templates.single.isOfficial, isTrue);
      expect(templates.single.sectionCount, 4);
    });

    test('maps a network failure to a network RepositoryException', () async {
      final repo = repositoryReturning(
        (request) => throw http.ClientException('offline'),
      );

      await expectLater(
        repo.listTemplates(),
        throwsA(
          isA<RepositoryException>().having(
            (e) => e.kind,
            'kind',
            RepositoryErrorKind.network,
          ),
        ),
      );
    });
  });

  group('startSession', () {
    test('posts testId and maps the session', () async {
      String? sentBody;
      final repo = repositoryReturning(
        (request) {
          expect(request.method, 'POST');
          expect(request.url.path, '/api/quiz/start');
          sentBody = request.body;
          return jsonOk({
            'id': 's1',
            'status': 'in_progress',
            'currentQuestionNo': 0,
            'totalQuestions': 10,
            'correctCount': 0,
            'remainingSeconds': 1800,
            'timeLimitSeconds': 1800,
          });
        },
      );

      final session = await repo.startSession('t1');

      expect(jsonDecode(sentBody!), {'testId': 't1'});
      expect(session.id, 's1');
      expect(session.totalQuestions, 10);
      expect(session.isCompleted, isFalse);
    });

    test('maps 403 to an unauthorized error with the status code', () async {
      final repo = repositoryReturning(
        (request) => http.Response('{"message":"entitlement denied"}', 403),
      );

      await expectLater(
        repo.startSession('t1'),
        throwsA(
          isA<RepositoryException>()
              .having((e) => e.kind, 'kind', RepositoryErrorKind.unauthorized)
              .having((e) => e.statusCode, 'statusCode', 403),
        ),
      );
    });
  });

  group('currentQuestion', () {
    test('maps the {question, session} payload', () async {
      final repo = repositoryReturning(
        (request) {
          expect(request.url.path, '/api/quiz/session/s1/question');
          return jsonOk({
            'question': {
              'id': 'q1',
              'prompt': '正しい敬語はどれですか。',
              'scenario': '会議の場面',
              'sectionCode': 'I-1',
              'options': [
                {'id': 'o1', 'optionKey': 'A', 'text': 'いたします'},
                {'id': 'o2', 'optionKey': 'B', 'text': 'します'},
              ],
            },
            'session': {
              'id': 's1',
              'status': 'in_progress',
              'currentQuestionNo': 0,
              'totalQuestions': 10,
              'correctCount': 0,
              'remainingSeconds': 1799,
            },
          });
        },
      );

      final current = await repo.currentQuestion('s1');

      expect(current.question, isNotNull);
      expect(current.question!.prompt, '正しい敬語はどれですか。');
      expect(current.question!.options, hasLength(2));
      expect(current.session.isCompleted, isFalse);
    });

    test('treats a null question as a completed session', () async {
      final repo = repositoryReturning(
        (request) => jsonOk({
          'question': null,
          'session': {
            'id': 's1',
            'status': 'completed',
            'currentQuestionNo': 10,
            'totalQuestions': 10,
            'correctCount': 7,
            'estimatedScore': 78,
            'estimatedBjtBand': 'N2',
          },
        }),
      );

      final current = await repo.currentQuestion('s1');

      expect(current.question, isNull);
      expect(current.session.isCompleted, isTrue);
      expect(current.session.estimatedBjtBand, 'N2');
    });

    test('throws invalidResponse on a fundamentally wrong shape', () async {
      final repo = repositoryReturning((request) => jsonOk('not-an-object'));

      await expectLater(
        repo.currentQuestion('s1'),
        throwsA(
          isA<RepositoryException>().having(
            (e) => e.kind,
            'kind',
            RepositoryErrorKind.invalidResponse,
          ),
        ),
      );
    });
  });

  group('submitAnswer', () {
    test('posts the answer and reads the nested session (no leak)', () async {
      String? sentBody;
      final repo = repositoryReturning(
        (request) {
          expect(request.method, 'POST');
          expect(request.url.path, '/api/quiz/session/s1/answer');
          sentBody = request.body;
          return jsonOk({
            'answer': {'questionId': 'q1'},
            'session': {
              'id': 's1',
              'status': 'in_progress',
              'currentQuestionNo': 1,
              'totalQuestions': 10,
              'correctCount': 1,
              'remainingSeconds': 1700,
            },
          });
        },
      );

      final session = await repo.submitAnswer(
        sessionId: 's1',
        questionId: 'q1',
        optionKey: 'A',
      );

      expect(jsonDecode(sentBody!), {'questionId': 'q1', 'optionKey': 'A'});
      expect(session.currentQuestionNo, 1);
      expect(session.correctCount, 1);
    });

    test('maps a 500 to a server error', () async {
      final repo = repositoryReturning(
        (request) => http.Response('{"message":"boom"}', 500),
      );

      await expectLater(
        repo.submitAnswer(sessionId: 's1', questionId: 'q1', optionKey: 'A'),
        throwsA(
          isA<RepositoryException>().having(
            (e) => e.kind,
            'kind',
            RepositoryErrorKind.server,
          ),
        ),
      );
    });
  });

  group('breakdown', () {
    test('maps the completed-session breakdown payload', () async {
      final repo = repositoryReturning(
        (request) {
          expect(request.method, 'GET');
          expect(
            request.url.path,
            '/api/quiz/session/s1/results/breakdown',
          );
          return jsonOk({
            'sessionId': 's1',
            'testId': 't1',
            'testTitleVi': 'Đề thi thử BJT',
            'testTitleJa': 'BJT 模擬',
            'estimatedScore': 78,
            'estimatedBjtBand': 'N2',
            'breakdown': [
              {
                'questionId': 'q1',
                'prompt': '正しい敬語はどれですか。',
                'selectedOption': 'A',
                'isCorrect': true,
                'explanationVi': 'Đáp án đúng vì...',
                'skillTag': 'keigo',
                'sectionCode': 'I-1',
              },
              {
                'questionId': 'q2',
                'prompt': '次の文に合う語を選びなさい。',
                'selectedOption': 'C',
                'isCorrect': false,
                'explanationVi': 'Câu này sai vì...',
                'skillTag': 'vocab',
                'sectionCode': 'II-2',
                'remediationCardId': 'card-9',
              },
            ],
          });
        },
      );

      final breakdown = await repo.breakdown('s1');

      expect(breakdown.sessionId, 's1');
      expect(breakdown.estimatedBjtBand, 'N2');
      expect(breakdown.total, 2);
      expect(breakdown.correctCount, 1);
      // Japanese + Vietnamese survive UTF-8 round-trip.
      expect(breakdown.items.first.prompt, '正しい敬語はどれですか。');
      expect(breakdown.items.first.isCorrect, isTrue);
      expect(breakdown.items.last.explanationVi, 'Câu này sai vì...');
      expect(breakdown.items.last.hasRemediation, isTrue);
      expect(breakdown.items.first.hasRemediation, isFalse);
    });

    test('maps 404 (session not completed) to a notFound error', () async {
      final repo = repositoryReturning(
        (request) => http.Response('{"message":"not completed"}', 404),
      );

      await expectLater(
        repo.breakdown('s1'),
        throwsA(
          isA<RepositoryException>().having(
            (e) => e.kind,
            'kind',
            RepositoryErrorKind.notFound,
          ),
        ),
      );
    });

    test('throws invalidResponse when the root is not an object', () async {
      final repo = repositoryReturning((request) => jsonOk('not-an-object'));

      await expectLater(
        repo.breakdown('s1'),
        throwsA(
          isA<RepositoryException>().having(
            (e) => e.kind,
            'kind',
            RepositoryErrorKind.invalidResponse,
          ),
        ),
      );
    });
  });
}
