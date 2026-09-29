import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nihongo_bjt/core/auth/auth_token_store.dart';
import 'package:nihongo_bjt/core/auth/secure_auth_token_store.dart';
import 'package:nihongo_bjt/core/config/app_environment.dart';
import 'package:nihongo_bjt/features/auth/data/go_native_auth_repository.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_repository.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_session.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_tokens.dart';

/// Resolved runtime configuration (single instance for the app lifetime).
final appEnvironmentProvider = Provider<AppEnvironment>((ref) {
  return AppEnvironment.fromDartDefine();
});

/// Secure persistence for the session token.
final authTokenStoreProvider = Provider<AuthTokenStore>((ref) {
  return SecureAuthTokenStore.withDefaults();
});

/// Go-native session token auth repository.
final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return GoNativeAuthRepository(
    environment: ref.watch(appEnvironmentProvider),
  );
});

/// Upper bound for session restore and secure token IO.
///
/// If secure storage or network stalls, protected API screens should fall back
/// to unauthenticated/error states instead of leaving loaders pending forever.
final authRefreshTimeoutProvider = Provider<Duration>((ref) {
  return const Duration(seconds: 12);
});

/// Owns the authentication session: restore on startup, sign-in, sign-out.
///
/// Kept alive for the app lifetime (the router depends on it continuously).
final authControllerProvider =
    AsyncNotifierProvider<AuthController, AuthSession>(AuthController.new);

class AuthController extends AsyncNotifier<AuthSession> {
  AuthTokenStore get _store => ref.read(authTokenStoreProvider);
  AuthRepository get _repository => ref.read(authRepositoryProvider);
  Duration get _timeout => ref.read(authRefreshTimeoutProvider);

  @override
  Future<AuthSession> build() => _restoreSession();

  /// Reads any stored session token and validates it against the server.
  /// Valid → authenticated; expired or invalid → unauthenticated.
  Future<AuthSession> _restoreSession() async {
    final AuthTokens? stored;
    try {
      stored = await _store.read().timeout(_timeout);
    } on Object {
      await _clearStoreBestEffort();
      return const AuthSession.unauthenticated();
    }

    if (stored == null) return const AuthSession.unauthenticated();

    // Check local expiry first to avoid unnecessary network calls.
    if (stored.isExpired) {
      await _clearStoreBestEffort();
      return const AuthSession.unauthenticated();
    }

    // Validate against the server to catch revoked sessions.
    try {
      final valid = await _repository
          .validateSession(stored.sessionToken)
          .timeout(_timeout);
      if (valid) return AuthSession.authenticated(stored);
    } on Object {
      // Network failure during validation: keep the stored session so the
      // user is not logged out due to transient connectivity issues.
      return AuthSession.authenticated(stored);
    }

    await _clearStoreBestEffort();
    return const AuthSession.unauthenticated();
  }

  /// Signs in with email/password against the Go-native API and persists the
  /// session token. On failure the state becomes an [AsyncError].
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
      await _store.write(tokens).timeout(_timeout);
      return AuthSession.authenticated(tokens);
    });
  }

  /// Returns the current session token for API calls, or `null` when no valid
  /// session exists. Unlike OIDC there is no refresh — expired sessions require
  /// re-authentication.
  Future<String?> currentAccessToken() async {
    final current = state.value?.tokens;
    if (current == null) return null;
    if (current.isExpired) {
      await _clearStoreBestEffort();
      state = const AsyncData(AuthSession.unauthenticated());
      return null;
    }
    return current.sessionToken;
  }

  /// Ends the session locally (and remotely when possible) and clears storage.
  Future<void> signOut() async {
    final current = state.value?.tokens;
    state = const AsyncLoading<AuthSession>();
    state = await AsyncValue.guard(() async {
      if (current != null) {
        try {
          await _repository.signOut(current.sessionToken);
        } on Object {
          // Best-effort remote logout; always clear the local session.
        }
      }
      await _clearStoreBestEffort();
      return const AuthSession.unauthenticated();
    });
  }

  Future<void> _clearStoreBestEffort() async {
    try {
      await _store.clear().timeout(_timeout);
    } on Object {
      // Never leave auth state loading because secure-storage cleanup stalled.
    }
  }
}
