/// Stable register failure categories that presentation code can translate
/// into safe, localized copy (never raw server text or tokens).
enum RegisterFailureCode {
  /// The email field was rejected by the server's validation.
  invalidEmail,

  /// The password field was rejected by the server's validation.
  invalidPassword,

  /// The display name field was rejected by the server's validation.
  invalidDisplayName,

  /// An account already exists for the supplied email.
  emailAlreadyRegistered,

  /// Self-service registration is not enabled on this server (HTTP 404/503).
  /// The backend `POST /auth/register` endpoint or its Keycloak admin client is
  /// not configured. See `docs/mobile/MOBILE_AUTH_GAP_REPORT.md`.
  unavailable,

  /// The registration server could not be reached.
  network,

  /// Any other unexpected failure.
  unknown,
}

/// Thrown when a registration attempt cannot complete.
///
/// Carries a stable [code] for localization. [message] is diagnostic only and
/// must never contain credentials or token values.
class RegisterException implements Exception {
  const RegisterException(
    this.message, {
    this.code = RegisterFailureCode.unknown,
    this.cause,
  });

  /// Fallback diagnostic description; UI should prefer localized [code] copy.
  final String message;

  /// Stable failure category for localization and tests.
  final RegisterFailureCode code;

  /// Optional originating error/exception for logging.
  final Object? cause;

  @override
  String toString() => 'RegisterException: $message';
}

/// Abstraction over the first-party account creation endpoint.
///
/// Implementations perform a real network call and must throw a
/// [RegisterException] on failure — they must never fabricate a successful
/// result. Passwords are passed only to the create call and never persisted.
// A single-method interface is intentional: it mirrors AuthRepository and keeps
// the network implementation swappable for tests and dependency injection.
// ignore: one_member_abstracts
abstract interface class RegisterRepository {
  /// Creates a new learner account. Returns normally on success; throws a
  /// [RegisterException] (with a stable [RegisterFailureCode]) on any failure.
  Future<void> register({
    required String displayName,
    required String email,
    required String password,
  });
}
