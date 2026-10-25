import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nihongo_bjt/core/config/app_environment.dart';
import 'package:nihongo_bjt/features/auth/data/go_native_auth_repository.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_repository.dart';

const _environment = AppEnvironment(
  apiBaseUrl: 'https://api.example.test',
  flashcardDataSource: 'mock',
  googleServerClientId: 'web-client.apps.googleusercontent.com',
);

GoNativeAuthRepository _repository(MockClient client) => GoNativeAuthRepository(
  environment: _environment,
  httpClient: client,
  now: () => DateTime.utc(2026),
);

void main() {
  test(
    'Google exchange posts only the ID token and returns the app session',
    () async {
      final client = MockClient((request) async {
        expect(request.url.path, '/api/auth/google');
        expect(request.headers['authorization'], isNull);
        expect(jsonDecode(request.body), {'idToken': 'google-id-token'});
        return http.Response('{"token":"app-session"}', 200);
      });

      final tokens = await _repository(client).signInWithGoogle(
        idToken: 'google-id-token',
      );

      expect(tokens.sessionToken, 'app-session');
      expect(
        tokens.expiresAt,
        DateTime.utc(2026).add(const Duration(hours: 24)),
      );
    },
  );

  for (final entry in <int, AuthFailureCode>{
    400: AuthFailureCode.invalidRequest,
    401: AuthFailureCode.invalidGoogleCredential,
    409: AuthFailureCode.googleAccountConflict,
    429: AuthFailureCode.rateLimited,
    500: AuthFailureCode.serverError,
    503: AuthFailureCode.serviceUnavailable,
  }.entries) {
    test(
      'Google exchange maps HTTP ${entry.key} to a safe failure code',
      () async {
        final client = MockClient(
          (_) async => http.Response('sensitive body', entry.key),
        );

        await expectLater(
          _repository(client).signInWithGoogle(idToken: 'google-id-token'),
          throwsA(
            isA<AuthException>().having(
              (error) => error.code,
              'code',
              entry.value,
            ),
          ),
        );
      },
    );
  }

  test('logout returns false for a CSRF rejection', () async {
    final client = MockClient((request) async {
      expect(request.headers['authorization'], 'Bearer app-session');
      return http.Response('', 403);
    });

    expect(await _repository(client).signOut('app-session'), isFalse);
  });
}
