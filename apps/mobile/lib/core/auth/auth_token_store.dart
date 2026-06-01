import 'package:nihongo_bjt/features/auth/domain/auth_tokens.dart';

/// Persists the authenticated session's tokens between app launches.
///
/// Implementations must use platform-secure storage (Keychain / encrypted
/// preferences). Tokens must never be written to logs or plaintext storage.
abstract interface class AuthTokenStore {
  /// Returns the stored tokens, or `null` if none/incomplete.
  Future<AuthTokens?> read();

  /// Persists [tokens], replacing any previous value.
  Future<void> write(AuthTokens tokens);

  /// Removes all stored tokens (sign-out).
  Future<void> clear();
}
