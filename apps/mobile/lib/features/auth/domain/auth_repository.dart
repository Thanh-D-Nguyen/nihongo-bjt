import 'package:nihongo_bjt/features/auth/domain/auth_tokens.dart';

/// Stable auth failure categories that presentation code can translate safely.
enum AuthFailureCode {
  cancelled,
  invalidCredentials,
  methodNotAllowed,
  invalidScope,
  clientMisconfigured,
  network,
  missingToken,
  unknown,
}

/// Hosted Keycloak browser entry point.
enum AuthBrowserFlow {
  signIn,
  register,
}

/// Thrown when an authentication operation cannot complete.
///
/// Carries a stable [code] for user-facing localization. The fallback [message]
/// and underlying [cause] are retained for diagnostics but must never include
/// token values.
class AuthException implements Exception {
  const AuthException(
    this.message, {
    this.code = AuthFailureCode.unknown,
    this.cause,
  });

  /// Fallback diagnostic description; UI should prefer localized [code] copy.
  final String message;

  /// Stable failure category for localization and tests.
  final AuthFailureCode code;

  /// Optional originating error/exception for logging.
  final Object? cause;

  @override
  String toString() => 'AuthException: $message';
}

/// Abstraction over the OIDC provider (Keycloak via AppAuth).
///
/// Implementations perform real network/browser flows and must throw
/// [AuthException] on failure — they must never fabricate a successful result.
abstract interface class AuthRepository {
  /// Runs the Authorization Code + PKCE flow in the system browser and
  /// exchanges the code for tokens. [idpHint] optionally pre-selects an
  /// identity provider (`kc_idp_hint`).
  Future<AuthTokens> signIn({
    String? idpHint,
    AuthBrowserFlow flow = AuthBrowserFlow.signIn,
  });

  /// Exchanges first-party username/password credentials for tokens against the
  /// mobile public client. Implementations must never persist the password.
  Future<AuthTokens> signInWithPassword({
    required String username,
    required String password,
  });

  /// Exchanges [refreshToken] for a fresh token set.
  Future<AuthTokens> refresh(String refreshToken);

  /// Ends the session at the provider. [idToken] is supplied as the
  /// `id_token_hint` when available.
  Future<void> signOut({String? idToken});
}
