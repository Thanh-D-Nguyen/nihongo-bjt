import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nihongo_bjt/core/api/api_client.dart';
import 'package:nihongo_bjt/core/api/repository_result.dart';
import 'package:nihongo_bjt/core/config/app_environment.dart';
import 'package:nihongo_bjt/core/content/data/content_repository.dart';
import 'package:nihongo_bjt/core/content/domain/content_models.dart';

void main() {
  const env = AppEnvironment(
    apiBaseUrl: 'https://api.test',
    keycloakIssuer: 'https://auth.test/realms/nihongo-bjt',
    oauthClientId: 'nihongo-mobile',
    oauthRedirectUri: 'com.nihongobjt.app://oauth2redirect',
    flashcardDataSource: 'api',
  );

  ContentRepository repositoryReturning(
    http.Response Function(http.Request request) handler,
  ) {
    final client = ApiClient(
      environment: env,
      httpClient: MockClient((request) async => handler(request)),
    );
    return ContentRepository(client);
  }

  // UTF-8 encoded JSON so Japanese/Vietnamese survives the round-trip.
  http.Response jsonOk(Object body) => http.Response.bytes(
    utf8.encode(jsonEncode(body)),
    200,
    headers: const {'content-type': 'application/json; charset=utf-8'},
  );

  group('searchDictionary', () {
    test('returns empty list without a network call for blank query', () async {
      var called = false;
      final repo = repositoryReturning((_) {
        called = true;
        return jsonOk(const []);
      });

      expect(await repo.searchDictionary('   '), isEmpty);
      expect(called, isFalse);
    });

    test('encodes the query and maps lexemes with senses', () async {
      late Uri requested;
      final repo = repositoryReturning((request) {
        requested = request.url;
        return jsonOk([
          {
            'id': 'lex-1',
            'headword': '会議',
            'reading': 'かいぎ',
            'jlptLevel': 'N3',
            'shortMeaningVi': 'cuộc họp',
            'senses': [
              {
                'id': 'sense-1',
                'position': 0,
                'partOfSpeech': 'danh từ',
                'meaningVi': 'cuộc họp, hội nghị',
                'exampleLinks': [
                  {
                    'exampleSentence': {
                      'id': 'ex-1',
                      'japaneseText': '会議に出ます。',
                      'reading': 'かいぎにでます。',
                      'translationVi': 'Tôi tham dự cuộc họp.',
                    },
                  },
                ],
              },
            ],
          },
        ]);
      });

      final results = await repo.searchDictionary('会議');

      expect(requested.path, '/api/dictionary/search');
      expect(requested.queryParameters['q'], '会議');
      expect(requested.queryParameters['limit'], '20');
      expect(results, hasLength(1));
      final lexeme = results.single;
      expect(lexeme.headword, '会議');
      expect(lexeme.primaryGloss, 'cuộc họp');
      expect(lexeme.senses.single.examples.single.translationVi,
          'Tôi tham dự cuộc họp.');
    });

    test('tolerates missing optional fields', () async {
      final repo = repositoryReturning(
        (_) => jsonOk([
          {'id': 'lex-2', 'headword': '本'},
        ]),
      );

      final lexeme = (await repo.searchDictionary('本')).single;
      expect(lexeme.reading, isNull);
      expect(lexeme.senses, isEmpty);
      expect(lexeme.primaryGloss, isNull);
    });
  });

  group('listKanji', () {
    test('sends limit/offset pagination and maps components', () async {
      late Uri requested;
      final repo = repositoryReturning((request) {
        requested = request.url;
        return jsonOk([
          {
            'id': 'kanji-1',
            'character': '議',
            'meaningVi': 'nghị',
            'onyomi': 'ギ',
            'strokeCount': 20,
            'strokeSvgPath': '/strokes/gi.svg',
            'components': [
              {'id': 'c1', 'position': 0, 'character': '言', 'hanViet': 'ngôn'},
            ],
            'examples': [
              {
                'id': 'e1',
                'position': 0,
                'word': '会議',
                'reading': 'かいぎ',
                'meaningVi': 'cuộc họp',
              },
            ],
          },
        ]);
      });

      final results = await repo.listKanji(query: 'N3', offset: 30);

      expect(requested.queryParameters['q'], 'N3');
      expect(requested.queryParameters['limit'], '30');
      expect(requested.queryParameters['offset'], '30');
      final kanji = results.single;
      expect(kanji.character, '議');
      expect(kanji.hasStrokeDiagram, isTrue);
      expect(kanji.components.single.hanViet, 'ngôn');
      expect(kanji.examples.single.word, '会議');
    });

    test('omits the q param when no query is given', () async {
      late Uri requested;
      final repo = repositoryReturning((request) {
        requested = request.url;
        return jsonOk(const []);
      });

      await repo.listKanji();
      expect(requested.queryParameters.containsKey('q'), isFalse);
    });
  });

  group('listGrammar', () {
    test('maps grammar points with details and examples', () async {
      final repo = repositoryReturning(
        (_) => jsonOk([
          {
            'id': 'g1',
            'pattern': '〜なければならない',
            'meaningVi': 'phải làm gì',
            'jlptLevel': 'N4',
            'details': [
              {
                'id': 'd1',
                'position': 0,
                'meaningVi': 'nghĩa vụ',
                'explanation': 'Diễn tả nghĩa vụ.',
                'exampleLinks': [
                  {
                    'exampleSentence': {
                      'id': 'gx1',
                      'japaneseText': '行かなければならない。',
                      'translationVi': 'Phải đi.',
                    },
                  },
                ],
              },
            ],
          },
        ]),
      );

      final grammar = (await repo.listGrammar()).single;
      expect(grammar.pattern, '〜なければならない');
      expect(grammar.details.single.examples.single.japaneseText,
          '行かなければならない。');
    });
  });

  group('search', () {
    test('unwraps the results envelope and routes hit kinds', () async {
      final repo = repositoryReturning(
        (_) => jsonOk({
          'results': [
            {'id': 'h1', 'kind': 'kanji', 'title': '議', 'reading': 'ギ'},
            {'id': 'h2', 'kind': 'grammar', 'title': '〜たい'},
            {'id': 'h3', 'kind': 'mystery', 'title': '?'},
          ],
        }),
      );

      final hits = await repo.search('議');
      expect(hits.map((h) => h.kind), [
        SearchHitKind.kanji,
        SearchHitKind.grammar,
        SearchHitKind.unknown,
      ]);
    });

    test('accepts a bare list response too', () async {
      final repo = repositoryReturning(
        (_) => jsonOk([
          {'id': 'h1', 'kind': 'lexeme', 'title': '本'},
        ]),
      );

      final hits = await repo.search('本');
      expect(hits.single.kind, SearchHitKind.lexeme);
    });
  });

  group('error mapping', () {
    test('maps 404 to notFound', () async {
      final repo = repositoryReturning(
        (_) => http.Response('not found', 404),
      );

      await expectLater(
        repo.kanji('missing'),
        throwsA(
          isA<RepositoryException>().having(
            (e) => e.kind,
            'kind',
            RepositoryErrorKind.notFound,
          ),
        ),
      );
    });

    test('maps a malformed (non-list) body to invalidResponse', () async {
      final repo = repositoryReturning(
        (_) => jsonOk({'unexpected': true}),
      );

      await expectLater(
        repo.searchDictionary('x'),
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
