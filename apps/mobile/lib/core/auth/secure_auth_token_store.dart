import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:nihongo_bjt/core/auth/auth_token_store.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_tokens.dart';

/// [AuthTokenStore] backed by [FlutterSecureStorage].
///
/// On Android values are kept in `EncryptedSharedPreferences`; on iOS in the
/// Keychain (available after first unlock). Each field is stored under its own
/// key so a partial/corrupt write reads back as "no session" rather than a
/// malformed one.
class SecureAuthTokenStore implements AuthTokenStore {
  const SecureAuthTokenStore(this._storage);

  /// Builds a store with hardened platform defaults.
  factory SecureAuthTokenStore.withDefaults() {
    return const SecureAuthTokenStore(
      FlutterSecureStorage(
        aOptions: AndroidOptions(encryptedSharedPreferences: true),
        iOptions: IOSOptions(
          accessibility: KeychainAccessibility.first_unlock,
        ),
      ),
    );
  }

  final FlutterSecureStorage _storage;

  static const String _kSessionToken = 'auth.session_token';
  static const String _kExpiresAt = 'auth.expires_at';

  @override
  Future<AuthTokens?> read() async {
    final token = await _storage.read(key: _kSessionToken);
    final expiresRaw = await _storage.read(key: _kExpiresAt);

    if (token == null || expiresRaw == null) return null;

    final expiresAt = DateTime.tryParse(expiresRaw);
    if (expiresAt == null) return null;

    return AuthTokens(
      sessionToken: token,
      expiresAt: expiresAt.toUtc(),
    );
  }

  @override
  Future<void> write(AuthTokens tokens) async {
    await _storage.write(key: _kSessionToken, value: tokens.sessionToken);
    await _storage.write(
      key: _kExpiresAt,
      value: tokens.expiresAt.toUtc().toIso8601String(),
    );
  }

  @override
  Future<void> clear() async {
    await _storage.delete(key: _kSessionToken);
    await _storage.delete(key: _kExpiresAt);
  }
}
