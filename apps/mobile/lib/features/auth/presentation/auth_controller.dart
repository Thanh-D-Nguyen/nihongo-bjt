import 'package:flutter_appauth/flutter_appauth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nihongo_bjt/core/auth/auth_token_store.dart';
import 'package:nihongo_bjt/core/auth/secure_auth_token_store.dart';
import 'package:nihongo_bjt/core/config/app_environment.dart';
import 'package:nihongo_bjt/features/auth/data/keycloak_auth_repository.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_repository.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_session.dart';

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
  Future<void> signIn({String? idpHint}) async {
    state = const AsyncLoading<AuthSession>();
    state = await AsyncValue.guard(() async {
      final tokens = await _repository.signIn(idpHint: idpHint);
      await _store.write(tokens);
      return AuthSession.authenticated(tokens);
    });
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
}
