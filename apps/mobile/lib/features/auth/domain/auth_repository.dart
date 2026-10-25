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
  /// HTTP 400 from POST /api/auth/google (malformed request).
  invalidRequest,
  /// HTTP 401 from POST /api/auth/google (Google token rejected).
  invalidGoogleCredential,
  /// HTTP 409: the Google email belongs to an existing non-Google account.
  googleAccountConflict,
  /// HTTP 429: too many sign-in attempts from this client.
  rateLimited,
  /// HTTP 500 from the API.
  serverError,
  /// HTTP 503: Google login is not configured on the server.
  serviceUnavailable,
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

  /// Exchanges a Google ID token for an app session via POST /api/auth/google.
  ///
  /// [idToken] must be a Google-signed ID token whose audience is the server's
  /// Google Web client ID. The returned tokens hold only the app session token.
  Future<AuthTokens> signInWithGoogle({required String idToken});

  /// Validates the current session via GET /api/auth/me.
  /// Returns `true` if the session is still valid.
  Future<bool> validateSession(String sessionToken);

  /// Ends the session via POST /api/auth/logout.
  ///
  /// Returns `true` only when the server confirmed revocation. Callers must
  /// clear local credentials regardless of the result.
  Future<bool> signOut(String sessionToken);
}
