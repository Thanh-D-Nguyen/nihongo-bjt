import 'package:nihongo_bjt/features/auth/domain/auth_tokens.dart';

/// Persistence contract for the authenticated session.
///
/// Implementations must be safe to call from the main isolate and must never
/// throw on read/clear — returning `null` signals "no stored session".
abstract interface class AuthTokenStore {
  /// Reads the persisted session tokens, or `null` when none exist.
  Future<AuthTokens?> read();

  /// Persists [tokens], replacing any previously stored value.
  Future<void> write(AuthTokens tokens);

  /// Removes any persisted session. Idempotent.
  Future<void> clear();
}
