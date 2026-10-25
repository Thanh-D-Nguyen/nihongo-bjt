import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/auth/auth_token_store.dart';
import 'package:nihongo_bjt/features/auth/data/google_id_token_source.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_repository.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_status.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_tokens.dart';
import 'package:nihongo_bjt/features/auth/presentation/auth_controller.dart';

class _Store implements AuthTokenStore {
  _Store([this.value]);

  AuthTokens? value;

  @override
  Future<void> clear() async => value = null;

  @override
  Future<AuthTokens?> read() async => value;

  @override
  Future<void> write(AuthTokens tokens) async => value = tokens;
}

class _Repository implements AuthRepository {
  _Repository({this.google, this.valid = true, this.revoked = true, this.logout});

  final Future<AuthTokens> Function(String idToken)? google;
  final bool valid;
  final bool revoked;
  final Future<bool> Function(String token)? logout;
  String? receivedGoogleToken;

  @override
  Future<AuthTokens> signInWithGoogle({required String idToken}) async {
    receivedGoogleToken = idToken;
    final handler = google;
    if (handler == null) throw const AuthException('not configured');
    return handler(idToken);
  }

  @override
  Future<AuthTokens> signInWithPassword({
    required String username,
    required String password,
  }) async => throw const AuthException('not configured');

  @override
  Future<bool> signOut(String sessionToken) async =>
      logout == null ? revoked : logout!(sessionToken);

  @override
  Future<bool> validateSession(String sessionToken) async => valid;
}

class _GoogleTokens implements GoogleIdTokenSource {
  _GoogleTokens(this.result);

  final Future<String> Function() result;

  @override
  Future<String> fetchIdToken() => result();
}

AuthTokens _tokens() => AuthTokens(
  sessionToken: 'session-token',
  expiresAt: DateTime.now().toUtc().add(const Duration(hours: 1)),
);

ProviderContainer _container({
  required _Store store,
  required _Repository repository,
  required GoogleIdTokenSource googleTokens,
}) {
  final container = ProviderContainer(
    overrides: [
      authTokenStoreProvider.overrideWithValue(store),
      authRepositoryProvider.overrideWithValue(repository),
      googleIdTokenSourceProvider.overrideWithValue(googleTokens),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  test('restores a valid secure session', () async {
    final tokens = _tokens();
    final container = _container(
      store: _Store(tokens),
      repository: _Repository(),
      googleTokens: _GoogleTokens(() async => 'unused'),
    );

    final session = await container.read(authControllerProvider.future);

    expect(session.status, AuthStatus.authenticated);
    expect(session.tokens, tokens);
  });

  test(
    'Google sign-in exchanges and securely persists only the app session',
    () async {
      final tokens = _tokens();
      final store = _Store();
      final repository = _Repository(google: (_) async => tokens);
      final container = _container(
        store: store,
        repository: repository,
        googleTokens: _GoogleTokens(() async => 'google-id-token'),
      );

      await container.read(authControllerProvider.future);
      await container.read(authControllerProvider.notifier).signInWithGoogle();

      expect(repository.receivedGoogleToken, 'google-id-token');
      expect(await store.read(), tokens);
      expect(
        container.read(authControllerProvider).value!.status,
        AuthStatus.authenticated,
      );
    },
  );

  test(
    'Google cancellation restores the unauthenticated state without error',
    () async {
      final store = _Store();
      final container = _container(
        store: store,
        repository: _Repository(),
        googleTokens: _GoogleTokens(
          () async => throw const AuthException(
            'cancelled',
            code: AuthFailureCode.cancelled,
          ),
        ),
      );

      await container.read(authControllerProvider.future);
      await container.read(authControllerProvider.notifier).signInWithGoogle();

      expect(container.read(authControllerProvider).hasError, isFalse);
      expect(
        container.read(authControllerProvider).value!.status,
        AuthStatus.unauthenticated,
      );
      expect(await store.read(), isNull);
    },
  );

  test(
    'Google exchange failures remain an error and never persist credentials',
    () async {
      final store = _Store();
      final container = _container(
        store: store,
        repository: _Repository(
          google: (_) async => throw const AuthException(
            'conflict',
            code: AuthFailureCode.googleAccountConflict,
          ),
        ),
        googleTokens: _GoogleTokens(() async => 'google-id-token'),
      );

      await container.read(authControllerProvider.future);
      await container.read(authControllerProvider.notifier).signInWithGoogle();

      expect(container.read(authControllerProvider).hasError, isTrue);
      expect(await store.read(), isNull);
    },
  );

  test(
    'logout clears secure storage even when remote revocation fails',
    () async {
      final store = _Store(_tokens());
      final container = _container(
        store: store,
        repository: _Repository(revoked: false),
        googleTokens: _GoogleTokens(() async => 'unused'),
      );

      await container.read(authControllerProvider.future);
      final revoked = await container
          .read(authControllerProvider.notifier)
          .signOut();

      expect(revoked, isFalse);
      expect(await store.read(), isNull);
      expect(
        container.read(authControllerProvider).value!.status,
        AuthStatus.unauthenticated,
      );
    },
  );

  test('logout hides the previous token while remote revocation is pending', () async {
    final pending = Completer<bool>();
    final container = _container(
      store: _Store(_tokens()),
      repository: _Repository(logout: (_) => pending.future),
      googleTokens: _GoogleTokens(() async => 'unused'),
    );
    await container.read(authControllerProvider.future);
    final logout = container.read(authControllerProvider.notifier).signOut();
    expect(await container.read(authControllerProvider.notifier).currentAccessToken(), isNull);
    expect(container.read(authControllerProvider).value?.status, AuthStatus.unauthenticated);
    pending.complete(true);
    expect(await logout, isTrue);
  });
}

