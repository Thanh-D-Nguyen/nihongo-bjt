import 'package:nihongo_bjt/features/auth/domain/auth_tokens.dart';

/// Thrown when an authentication operation cannot complete.
///
/// Carries a human-meaningful [message]; the underlying [cause] is retained for
/// diagnostics but never assumed to be safe to display verbatim. Token values
/// must never be placed in [message] or [cause].
class AuthException implements Exception {
  const AuthException(this.message, {this.cause});

  /// Short description suitable for user-facing error surfaces.
  final String message;

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
  Future<AuthTokens> signIn({String? idpHint});

  /// Exchanges [refreshToken] for a fresh token set.
  Future<AuthTokens> refresh(String refreshToken);

  /// Ends the session at the provider. [idToken] is supplied as the
  /// `id_token_hint` when available.
  Future<void> signOut({String? idToken});
}
