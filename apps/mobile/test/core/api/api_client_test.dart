import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nihongo_bjt/core/api/api_client.dart';
import 'package:nihongo_bjt/core/api/api_exception.dart';
import 'package:nihongo_bjt/core/config/app_environment.dart';

void main() {
  const env = AppEnvironment(
    apiBaseUrl: 'https://api.test',
    keycloakIssuer: 'https://auth.test/realms/nihongo-bjt',
    oauthClientId: 'nihongo-mobile',
    oauthRedirectUri: 'com.nihongobjt.app://oauth2redirect',
    flashcardDataSource: 'mock',
  );

  ApiClient clientReturning(
    http.Response Function(http.Request request) handler,
  ) {
    return ApiClient(
      environment: env,
      httpClient: MockClient((request) async => handler(request)),
    );
  }

  group('ApiClient.getJson', () {
    test('returns the decoded JSON body on 200', () async {
      final client = clientReturning(
        (request) => http.Response(jsonEncode({'ok': true}), 200),
      );

      expect(await client.getJson('/ping'), {'ok': true});
    });

    test('builds the request URL from base URL + path', () async {
      late Uri requested;
      final client = clientReturning((request) {
        requested = request.url;
        return http.Response('null', 200);
      });

      await client.getJson('/flashcards/decks');

      expect(requested.toString(), 'https://api.test/flashcards/decks');
    });

    test('returns null on an empty response body', () async {
      final client = clientReturning((request) => http.Response('', 200));

      expect(await client.getJson('/empty'), isNull);
    });

    test(
      'throws HttpApiException carrying the status code on non-2xx',
      () async {
        final client = clientReturning(
          (request) => http.Response('nope', 404),
        );

        await expectLater(
          client.getJson('/missing'),
          throwsA(
            isA<HttpApiException>().having(
              (e) => e.statusCode,
              'statusCode',
              404,
            ),
          ),
        );
      },
    );

    test('throws NetworkApiException when the transport fails', () async {
      final client = ApiClient(
        environment: env,
        httpClient: MockClient(
          (request) async => throw http.ClientException('boom'),
        ),
      );

      await expectLater(
        client.getJson('/down'),
        throwsA(isA<NetworkApiException>()),
      );
    });
  });
}
