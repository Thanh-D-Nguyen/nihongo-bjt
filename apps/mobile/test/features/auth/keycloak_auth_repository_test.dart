import 'dart:convert';

import 'package:flutter_appauth/flutter_appauth.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nihongo_bjt/core/config/app_environment.dart';
import 'package:nihongo_bjt/features/auth/data/keycloak_auth_repository.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_repository.dart';

const _localEnvironment = AppEnvironment(
  apiBaseUrl: 'http://localhost:4000',
  keycloakIssuer: 'http://localhost:8080/realms/nihongo-bjt',
  oauthClientId: 'nihongo-mobile',
  oauthRedirectUri: 'com.nihongobjt.app://oauth2redirect',
  flashcardDataSource: 'mock',
);

const _remoteEnvironment = AppEnvironment(
  apiBaseUrl: 'https://api.example.test',
  keycloakIssuer: 'https://auth.example.test/realms/nihongo-bjt',
  oauthClientId: 'nihongo-mobile',
  oauthRedirectUri: 'com.nihongobjt.app://oauth2redirect',
  flashcardDataSource: 'mock',
);

String _tokenBody() => jsonEncode({
  'access_token': 'access-token',
  'refresh_token': 'refresh-token',
  'id_token': 'id-token',
  'expires_in': 3600,
});

KeycloakAuthRepository _repository({
  required AppEnvironment environment,
  required MockClient client,
}) {
  return KeycloakAuthRepository(
    appAuth: const FlutterAppAuth(),
    environment: environment,
    httpClient: client,
    now: () => DateTime.utc(2026),
  );
}

void main() {
  group('KeycloakAuthRepository.signInWithPassword', () {
    test(
      'retries local issuer through the Android emulator host alias',
      () async {
        final requests = <Uri>[];
        final client = MockClient((request) async {
          requests.add(request.url);
          if (request.url.host == 'localhost') {
            throw http.ClientException('connection refused', request.url);
          }

          expect(request.url.host, '10.0.2.2');
          expect(request.bodyFields['grant_type'], 'password');
          expect(request.bodyFields['client_id'], 'nihongo-mobile');
          expect(request.bodyFields['username'], 'learner');
          expect(request.bodyFields['password'], 'password');

          return http.Response(
            _tokenBody(),
            200,
            headers: const {'content-type': 'application/json'},
          );
        });
        final repository = _repository(
          environment: _localEnvironment,
          client: client,
        );

        final tokens = await repository.signInWithPassword(
          username: 'learner',
          password: 'password',
        );

        expect(tokens.accessToken, 'access-token');
        expect(requests.map((uri) => uri.host), ['localhost', '10.0.2.2']);
      },
    );

    test('does not retry remote issuers after a network failure', () async {
      final requests = <Uri>[];
      final client = MockClient((request) async {
        requests.add(request.url);
        throw http.ClientException('connection refused', request.url);
      });
      final repository = _repository(
        environment: _remoteEnvironment,
        client: client,
      );

      await expectLater(
        repository.signInWithPassword(
          username: 'learner',
          password: 'password',
        ),
        throwsA(
          isA<AuthException>().having(
            (error) => error.code,
            'code',
            AuthFailureCode.network,
          ),
        ),
      );

      expect(requests.single.host, 'auth.example.test');
    });

    test(
      'does not hide Keycloak credential errors behind emulator retry',
      () async {
        final requests = <Uri>[];
        final client = MockClient((request) async {
          requests.add(request.url);
          return http.Response(
            jsonEncode({
              'error': 'invalid_grant',
              'error_description': 'Invalid user credentials',
            }),
            400,
            headers: const {'content-type': 'application/json'},
          );
        });
        final repository = _repository(
          environment: _localEnvironment,
          client: client,
        );

        await expectLater(
          repository.signInWithPassword(
            username: 'learner',
            password: 'wrong-password',
          ),
          throwsA(
            isA<AuthException>().having(
              (error) => error.code,
              'code',
              AuthFailureCode.invalidCredentials,
            ),
          ),
        );

        expect(requests.single.host, 'localhost');
      },
    );
  });
}
