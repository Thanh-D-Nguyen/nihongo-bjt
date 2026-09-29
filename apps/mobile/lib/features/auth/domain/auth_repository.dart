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

/// Abstraction over the Go-native session token authentication backend.
///
/// Implementations perform real network calls against the Go API and must throw
/// [AuthException] on failure — they must never fabricate a successful result.
abstract interface class AuthRepository {
  /// Authenticates with email + password against POST /api/auth/login.
  /// Returns the session token on success.
  Future<AuthTokens> signInWithPassword({
    required String username,
    required String password,
  });

  /// Validates the current session via GET /api/auth/me.
  /// Returns `true` if the session is still valid.
  Future<bool> validateSession(String sessionToken);

  /// Ends the session via POST /api/auth/logout.
  Future<void> signOut(String sessionToken);
}
