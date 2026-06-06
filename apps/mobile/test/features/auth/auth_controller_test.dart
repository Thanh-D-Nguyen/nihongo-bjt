import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/auth/auth_token_store.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_repository.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_status.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_tokens.dart';
import 'package:nihongo_bjt/features/auth/presentation/auth_controller.dart';

/// In-memory [AuthTokenStore] for tests.
class _FakeTokenStore implements AuthTokenStore {
  _FakeTokenStore([this._tokens]);

  AuthTokens? _tokens;

  @override
  Future<AuthTokens?> read() async => _tokens;

  @override
  Future<void> write(AuthTokens tokens) async => _tokens = tokens;

  @override
  Future<void> clear() async => _tokens = null;
}

class _HangingReadTokenStore implements AuthTokenStore {
  int clearCalls = 0;

  @override
  Future<AuthTokens?> read() => Completer<AuthTokens?>().future;

  @override
  Future<void> write(AuthTokens tokens) async {}

  @override
  Future<void> clear() async {
    clearCalls += 1;
  }
}

/// Scriptable [AuthRepository] for tests.
class _FakeAuthRepository implements AuthRepository {
  _FakeAuthRepository({this.onSignIn, this.onPasswordSignIn, this.onRefresh});

  final Future<AuthTokens> Function()? onSignIn;
  final Future<AuthTokens> Function()? onPasswordSignIn;
  final Future<AuthTokens> Function()? onRefresh;
  int refreshCalls = 0;
  AuthBrowserFlow? lastBrowserFlow;
  bool signOutCalled = false;

  @override
  Future<AuthTokens> signIn({
    String? idpHint,
    AuthBrowserFlow flow = AuthBrowserFlow.signIn,
  }) async {
    lastBrowserFlow = flow;
    final handler = onSignIn;
    if (handler == null) throw const AuthException('no sign-in');
    return handler();
  }

  @override
  Future<AuthTokens> signInWithPassword({
    required String username,
    required String password,
  }) async {
    final handler = onPasswordSignIn;
    if (handler == null) throw const AuthException('no password sign-in');
    return handler();
  }

  @override
  Future<AuthTokens> refresh(String refreshToken) async {
    refreshCalls += 1;
    final handler = onRefresh;
    if (handler == null) throw const AuthException('no refresh');
    return handler();
  }

  @override
  Future<void> signOut({String? idToken}) async => signOutCalled = true;
}

AuthTokens _tokens({required bool expired}) {
  final now = DateTime.now().toUtc();
  return AuthTokens(
    accessToken: 'access',
    refreshToken: 'refresh',
    idToken: 'id',
    accessTokenExpiresAt: expired
        ? now.subtract(const Duration(minutes: 1))
        : now.add(const Duration(hours: 1)),
  );
}

ProviderContainer _container({
  required AuthTokenStore store,
  required AuthRepository repository,
  Duration refreshTimeout = const Duration(seconds: 12),
}) {
  final container = ProviderContainer(
    overrides: [
      authTokenStoreProvider.overrideWithValue(store),
      authRepositoryProvider.overrideWithValue(repository),
      authRefreshTimeoutProvider.overrideWithValue(refreshTimeout),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  group('AuthController.restore', () {
    test('no stored tokens -> unauthenticated', () async {
      final container = _container(
        store: _FakeTokenStore(),
        repository: _FakeAuthRepository(),
      );

      final session = await container.read(authControllerProvider.future);
      expect(session.status, AuthStatus.unauthenticated);
      expect(session.tokens, isNull);
    });

    test('valid stored tokens -> authenticated without refresh', () async {
      final tokens = _tokens(expired: false);
      final container = _container(
        store: _FakeTokenStore(tokens),
        repository: _FakeAuthRepository(
          onRefresh: () async => fail('refresh must not be called'),
        ),
      );

      final session = await container.read(authControllerProvider.future);
      expect(session.status, AuthStatus.authenticated);
      expect(session.tokens, tokens);
    });

    test('expired tokens -> refreshes and persists new session', () async {
      final fresh = _tokens(expired: false);
      final store = _FakeTokenStore(_tokens(expired: true));
      final container = _container(
        store: store,
        repository: _FakeAuthRepository(onRefresh: () async => fresh),
      );

      final session = await container.read(authControllerProvider.future);
      expect(session.status, AuthStatus.authenticated);
      expect(await store.read(), fresh);
    });

    test('expired tokens with failing refresh -> clears session', () async {
      final store = _FakeTokenStore(_tokens(expired: true));
      final container = _container(
        store: store,
        repository: _FakeAuthRepository(
          onRefresh: () async => throw const AuthException('expired'),
        ),
      );

      final session = await container.read(authControllerProvider.future);
      expect(session.status, AuthStatus.unauthenticated);
      expect(await store.read(), isNull);
    });

    test('expired tokens with stuck refresh -> clears session', () async {
      final store = _FakeTokenStore(_tokens(expired: true));
      final container = _container(
        store: store,
        repository: _FakeAuthRepository(
          onRefresh: () => Completer<AuthTokens>().future,
        ),
        refreshTimeout: const Duration(milliseconds: 1),
      );

      final session = await container.read(authControllerProvider.future);

      expect(session.status, AuthStatus.unauthenticated);
      expect(await store.read(), isNull);
    });

    test('stuck token-store read -> unauthenticated', () async {
      final store = _HangingReadTokenStore();
      final container = _container(
        store: store,
        repository: _FakeAuthRepository(),
        refreshTimeout: const Duration(milliseconds: 1),
      );

      final session = await container.read(authControllerProvider.future);

      expect(session.status, AuthStatus.unauthenticated);
      expect(store.clearCalls, 1);
    });
  });

  group('AuthController.signIn', () {
    test('persists tokens and becomes authenticated', () async {
      final tokens = _tokens(expired: false);
      final store = _FakeTokenStore();
      final container = _container(
        store: store,
        repository: _FakeAuthRepository(onSignIn: () async => tokens),
      );

      await container.read(authControllerProvider.future);
      await container.read(authControllerProvider.notifier).signIn();

      final session = container.read(authControllerProvider).value!;
      expect(session.status, AuthStatus.authenticated);
      expect(await store.read(), tokens);
    });

    test('failure leaves the session unauthenticated as an error', () async {
      final store = _FakeTokenStore();
      final container = _container(
        store: store,
        repository: _FakeAuthRepository(
          onSignIn: () async => throw const AuthException('cancelled'),
        ),
      );

      await container.read(authControllerProvider.future);
      await container.read(authControllerProvider.notifier).signIn();

      expect(container.read(authControllerProvider).hasError, isTrue);
      expect(await store.read(), isNull);
    });

    test('passes through the requested browser flow', () async {
      final tokens = _tokens(expired: false);
      final repository = _FakeAuthRepository(onSignIn: () async => tokens);
      final container = _container(
        store: _FakeTokenStore(),
        repository: repository,
      );

      await container.read(authControllerProvider.future);
      await container
          .read(authControllerProvider.notifier)
          .signIn(
            flow: AuthBrowserFlow.register,
          );

      expect(repository.lastBrowserFlow, AuthBrowserFlow.register);
    });
  });

  group('AuthController.signInWithPassword', () {
    test('persists tokens and becomes authenticated', () async {
      final tokens = _tokens(expired: false);
      final store = _FakeTokenStore();
      final container = _container(
        store: store,
        repository: _FakeAuthRepository(onPasswordSignIn: () async => tokens),
      );

      await container.read(authControllerProvider.future);
      await container
          .read(authControllerProvider.notifier)
          .signInWithPassword(
            username: 'testuser',
            password: '123456',
          );

      final session = container.read(authControllerProvider).value!;
      expect(session.status, AuthStatus.authenticated);
      expect(await store.read(), tokens);
    });
  });

  group('AuthController.currentAccessToken', () {
    test('returns valid access token without refresh', () async {
      final tokens = _tokens(expired: false);
      final repository = _FakeAuthRepository(
        onRefresh: () async => fail('refresh must not be called'),
      );
      final container = _container(
        store: _FakeTokenStore(tokens),
        repository: repository,
      );

      await container.read(authControllerProvider.future);
      final accessToken = await container
          .read(authControllerProvider.notifier)
          .currentAccessToken();

      expect(accessToken, tokens.accessToken);
      expect(repository.refreshCalls, 0);
    });

    test('refreshes expired access token and persists session', () async {
      final fresh = _tokens(expired: false);
      final store = _FakeTokenStore(_tokens(expired: true));
      final repository = _FakeAuthRepository(onRefresh: () async => fresh);
      final container = _container(store: store, repository: repository);

      await container.read(authControllerProvider.future);
      final accessToken = await container
          .read(authControllerProvider.notifier)
          .currentAccessToken();

      expect(accessToken, fresh.accessToken);
      expect(await store.read(), fresh);
      expect(repository.refreshCalls, 1);
    });

    test('clears session when refresh fails', () async {
      final store = _FakeTokenStore(_tokens(expired: true));
      final container = _container(
        store: store,
        repository: _FakeAuthRepository(
          onRefresh: () async => throw const AuthException('expired'),
        ),
      );

      await container.read(authControllerProvider.future);
      final accessToken = await container
          .read(authControllerProvider.notifier)
          .currentAccessToken();

      expect(accessToken, isNull);
      expect(await store.read(), isNull);
      expect(
        container.read(authControllerProvider).value!.isAuthenticated,
        false,
      );
    });

    test('clears session when refresh hangs after token expiry', () async {
      final expired = _tokens(expired: true);
      final store = _FakeTokenStore();
      final container = _container(
        store: store,
        repository: _FakeAuthRepository(
          onPasswordSignIn: () async => expired,
          onRefresh: () => Completer<AuthTokens>().future,
        ),
        refreshTimeout: const Duration(milliseconds: 1),
      );

      await container.read(authControllerProvider.future);
      await container
          .read(authControllerProvider.notifier)
          .signInWithPassword(
            username: 'testuser',
            password: '123456',
          );
      final accessToken = await container
          .read(authControllerProvider.notifier)
          .currentAccessToken();

      expect(accessToken, isNull);
      expect(await store.read(), isNull);
      expect(
        container.read(authControllerProvider).value!.isAuthenticated,
        false,
      );
    });
  });

  group('AuthController.signOut', () {
    test('clears storage and becomes unauthenticated', () async {
      final tokens = _tokens(expired: false);
      final store = _FakeTokenStore(tokens);
      final repository = _FakeAuthRepository();
      final container = _container(store: store, repository: repository);

      await container.read(authControllerProvider.future);
      await container.read(authControllerProvider.notifier).signOut();

      final session = container.read(authControllerProvider).value!;
      expect(session.status, AuthStatus.unauthenticated);
      expect(await store.read(), isNull);
      expect(repository.signOutCalled, isTrue);
    });
  });
}
