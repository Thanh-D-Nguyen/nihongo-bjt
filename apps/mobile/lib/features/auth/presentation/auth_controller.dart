import 'package:flutter_appauth/flutter_appauth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nihongo_bjt/core/auth/auth_token_store.dart';
import 'package:nihongo_bjt/core/auth/secure_auth_token_store.dart';
import 'package:nihongo_bjt/core/config/app_environment.dart';
import 'package:nihongo_bjt/features/auth/data/keycloak_auth_repository.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_repository.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_session.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_tokens.dart';

/// Resolved runtime configuration (single instance for the app lifetime).
final appEnvironmentProvider = Provider<AppEnvironment>((ref) {
  return AppEnvironment.fromDartDefine();
});

/// AppAuth client used by the Keycloak repository.
final appAuthProvider = Provider<FlutterAppAuth>((ref) {
  return const FlutterAppAuth();
});

/// Secure persistence for the session tokens.
final authTokenStoreProvider = Provider<AuthTokenStore>((ref) {
  return SecureAuthTokenStore.withDefaults();
});

/// OIDC provider abstraction (Keycloak via AppAuth).
final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return KeycloakAuthRepository(
    appAuth: ref.watch(appAuthProvider),
    environment: ref.watch(appEnvironmentProvider),
  );
});

/// Owns the authentication session: restore on startup, sign-in, sign-out.
///
/// Kept alive for the app lifetime (the router depends on it continuously).
final authControllerProvider =
    AsyncNotifierProvider<AuthController, AuthSession>(AuthController.new);

class AuthController extends AsyncNotifier<AuthSession> {
  AuthTokenStore get _store => ref.read(authTokenStoreProvider);
  AuthRepository get _repository => ref.read(authRepositoryProvider);
  Future<AuthTokens>? _refreshInFlight;

  @override
  Future<AuthSession> build() => _restoreSession();

  /// Reads any stored tokens and decides the initial session: valid → keep;
  /// expired but refreshable → refresh; otherwise unauthenticated.
  Future<AuthSession> _restoreSession() async {
    final stored = await _store.read();
    if (stored == null) return const AuthSession.unauthenticated();

    if (!stored.isAccessTokenExpired) {
      return AuthSession.authenticated(stored);
    }

    try {
      final refreshed = await _repository.refresh(stored.refreshToken);
      await _store.write(refreshed);
      return AuthSession.authenticated(refreshed);
    } on Object {
      // Refresh failed (expired/revoked): drop the stale session.
      await _store.clear();
      return const AuthSession.unauthenticated();
    }
  }

  /// Starts the browser sign-in flow and persists the resulting session.
  /// On failure the state becomes an [AsyncError] and remains unauthenticated.
  Future<void> signIn({
    String? idpHint,
    AuthBrowserFlow flow = AuthBrowserFlow.signIn,
  }) async {
    state = const AsyncLoading<AuthSession>();
    state = await AsyncValue.guard(() async {
      final tokens = await _repository.signIn(idpHint: idpHint, flow: flow);
      await _store.write(tokens);
      return AuthSession.authenticated(tokens);
    });
  }

  /// Signs in with the first-party email/password form and persists tokens.
  /// Passwords are passed only to the provider call and are never stored.
  Future<void> signInWithPassword({
    required String username,
    required String password,
  }) async {
    state = const AsyncLoading<AuthSession>();
    state = await AsyncValue.guard(() async {
      final tokens = await _repository.signInWithPassword(
        username: username,
        password: password,
      );
      await _store.write(tokens);
      return AuthSession.authenticated(tokens);
    });
  }

  /// Returns a valid access token for API calls, refreshing the session when
  /// the stored access token is near expiry. Returns `null` when no valid
  /// session can be recovered.
  Future<String?> currentAccessToken() async {
    final current = state.value?.tokens;
    if (current == null) return null;
    if (!current.isAccessTokenExpired) return current.accessToken;

    final refreshed = await _refreshCurrentSession(current.refreshToken);
    return refreshed?.accessToken;
  }

  /// Ends the session locally (and remotely when possible) and clears storage.
  Future<void> signOut() async {
    final current = state.value?.tokens;
    state = const AsyncLoading<AuthSession>();
    state = await AsyncValue.guard(() async {
      try {
        await _repository.signOut(idToken: current?.idToken);
      } on Object {
        // Best-effort remote logout; always clear the local session.
      }
      await _store.clear();
      return const AuthSession.unauthenticated();
    });
  }

  Future<AuthTokens?> _refreshCurrentSession(String refreshToken) async {
    final existing = _refreshInFlight;
    if (existing != null) {
      try {
        return await existing;
      } on Object {
        return null;
      }
    }

    final refresh = _repository.refresh(refreshToken);
    _refreshInFlight = refresh;
    try {
      final refreshed = await refresh;
      await _store.write(refreshed);
      state = AsyncData(AuthSession.authenticated(refreshed));
      return refreshed;
    } on Object {
      await _store.clear();
      state = const AsyncData(AuthSession.unauthenticated());
      return null;
    } finally {
      if (_refreshInFlight == refresh) {
        _refreshInFlight = null;
      }
    }
  }
}
