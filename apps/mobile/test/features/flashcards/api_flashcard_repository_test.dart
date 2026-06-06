import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nihongo_bjt/core/api/api_client.dart';
import 'package:nihongo_bjt/core/config/app_environment.dart';
import 'package:nihongo_bjt/features/flashcards/data/api_flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/domain/srs_rating.dart';

void main() {
  const env = AppEnvironment(
    apiBaseUrl: 'https://api.test',
    keycloakIssuer: 'https://auth.test/realms/nihongo-bjt',
    oauthClientId: 'nihongo-mobile',
    oauthRedirectUri: 'com.nihongobjt.app://oauth2redirect',
    flashcardDataSource: 'api',
  );

  ApiFlashcardRepository repositoryReturning(
    http.Response Function(http.Request request) handler, {
    String? token,
  }) {
    final client = ApiClient(
      environment: env,
      httpClient: MockClient((request) async => handler(request)),
      accessTokenProvider: token == null ? null : () async => token,
    );
    return ApiFlashcardRepository(client);
  }

  // Encodes a JSON body as UTF-8 so non-ASCII (Japanese/Vietnamese) survives
  // the HTTP round-trip; the bare `http.Response(String, ...)` ctor uses
  // Latin1.
  http.Response jsonOk(Object body) => http.Response.bytes(
    utf8.encode(jsonEncode(body)),
    200,
    headers: const {'content-type': 'application/json; charset=utf-8'},
  );

  group('fetchDecks', () {
    test('maps the decks payload to the domain', () async {
      final repo = repositoryReturning(
        (request) => jsonOk([
          {
            'id': 'deck-1',
            'titleVi': 'Từ vựng BJT J2',
            'titleJa': 'BJT 語彙 J2',
            'descriptionVi': 'mô tả',
            'visibility': 'private',
            'status': 'active',
            'cloneCount': 0,
            'createdAt': '2026-05-01T08:00:00.000Z',
            'updatedAt': '2026-05-02T09:30:00.000Z',
            '_count': {'cards': 24},
          },
        ]),
      );

      final decks = await repo.fetchDecks();

      expect(decks, hasLength(1));
      expect(decks.single.title, 'BJT 語彙 J2');
      expect(decks.single.cardCount, 24);
    });

    test('attaches the bearer token to the request', () async {
      String? sentAuth;
      final repo = repositoryReturning(
        (request) {
          sentAuth = request.headers['authorization'];
          return http.Response('[]', 200);
        },
        token: 'access-123',
      );

      await repo.fetchDecks();

      expect(sentAuth, 'Bearer access-123');
    });

    test('maps 401 to a clear auth-required error (no fake data)', () async {
      final repo = repositoryReturning(
        (request) => http.Response('{"message":"unauthorized"}', 401),
      );

      await expectLater(
        repo.fetchDecks(),
        throwsA(
          isA<FlashcardRepositoryException>()
              .having(
                (e) => e.message,
                'message',
                contains('đăng nhập'),
              )
              .having(
                (e) => e.isAuthRequired,
                'isAuthRequired',
                isTrue,
              ),
        ),
      );
    });

    test('maps a transport failure to a connection error', () async {
      final repo = repositoryReturning(
        (request) => throw http.ClientException('boom'),
      );

      await expectLater(
        repo.fetchDecks(),
        throwsA(
          isA<FlashcardRepositoryException>().having(
            (e) => e.message,
            'message',
            contains('kết nối'),
          ),
        ),
      );
    });
  });

  group('fetchCards', () {
    test('maps the due-review queue to domain cards', () async {
      final repo = repositoryReturning(
        (request) {
          expect(request.url.path, '/api/flashcards/reviews/due');
          expect(request.url.queryParameters['deckId'], 'any-deck');
          return jsonOk([
            {
              'id': 'uf-100',
              'cardId': 'card-10',
              'card': {
                'id': 'card-10',
                'frontText': '出張',
                'backText': 'chuyến công tác',
                'reading': 'しゅっちょう',
              },
              'state': 'review',
              'comebackMode': false,
              'leeched': false,
              'examples': <Object?>[],
            },
          ]);
        },
      );

      final cards = await repo.fetchCards('any-deck');

      expect(cards, hasLength(1));
      expect(cards.single.id, 'card-10');
      expect(cards.single.front, '出張');
      expect(cards.single.back, 'chuyến công tác');
    });

    test('maps 403 to a clear auth-required error', () async {
      final repo = repositoryReturning(
        (request) => http.Response('{"message":"forbidden"}', 403),
      );

      await expectLater(
        repo.fetchCards('any-deck'),
        throwsA(isA<FlashcardRepositoryException>()),
      );
    });

    test('omits the deckId param for a blank deck id', () async {
      final repo = repositoryReturning(
        (request) {
          expect(request.url.path, '/api/flashcards/reviews/due');
          expect(request.url.queryParameters.containsKey('deckId'), isFalse);
          return jsonOk(<Object?>[]);
        },
      );

      final cards = await repo.fetchCards('   ');

      expect(cards, isEmpty);
    });
  });

  group('submitReviewRating', () {
    test('POSTs the grade to the userFlashcard review endpoint', () async {
      String? sentPath;
      String? sentBody;
      String? sentAuth;
      final repo = repositoryReturning(
        (request) {
          sentPath = request.url.path;
          sentBody = request.body;
          sentAuth = request.headers['authorization'];
          return http.Response('', 200);
        },
        token: 'access-123',
      );

      await repo.submitReviewRating(
        userFlashcardId: 'uf-100',
        rating: SrsRating.good,
      );

      expect(sentPath, '/api/flashcards/reviews/uf-100');
      // Only the grade is sent; the learner is resolved server-side.
      expect(jsonDecode(sentBody!), {'rating': 'good'});
      expect(sentAuth, 'Bearer access-123');
    });

    test('maps 401 to a clear auth-required error (no fake success)', () async {
      final repo = repositoryReturning(
        (request) => http.Response('{"message":"unauthorized"}', 401),
      );

      await expectLater(
        repo.submitReviewRating(
          userFlashcardId: 'uf-100',
          rating: SrsRating.again,
        ),
        throwsA(
          isA<FlashcardRepositoryException>()
              .having(
                (e) => e.message,
                'message',
                contains('đăng nhập'),
              )
              .having(
                (e) => e.isAuthRequired,
                'isAuthRequired',
                isTrue,
              ),
        ),
      );
    });
  });
}
