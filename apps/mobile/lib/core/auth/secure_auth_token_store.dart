import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:nihongo_bjt/core/auth/auth_token_store.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_tokens.dart';

/// [AuthTokenStore] backed by [FlutterSecureStorage].
///
/// On Android values are kept in `EncryptedSharedPreferences`; on iOS in the
/// Keychain (available after first unlock). Each token is stored under its own
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

  static const String _kAccess = 'auth.access_token';
  static const String _kRefresh = 'auth.refresh_token';
  static const String _kId = 'auth.id_token';
  static const String _kExpiresAt = 'auth.access_expires_at';

  @override
  Future<AuthTokens?> read() async {
    final access = await _storage.read(key: _kAccess);
    final refresh = await _storage.read(key: _kRefresh);
    final id = await _storage.read(key: _kId);
    final expiresRaw = await _storage.read(key: _kExpiresAt);

    if (access == null || refresh == null || id == null || expiresRaw == null) {
      return null;
    }
    final expiresAt = DateTime.tryParse(expiresRaw);
    if (expiresAt == null) return null;

    return AuthTokens(
      accessToken: access,
      refreshToken: refresh,
      idToken: id,
      accessTokenExpiresAt: expiresAt.toUtc(),
    );
  }

  @override
  Future<void> write(AuthTokens tokens) async {
    await _storage.write(key: _kAccess, value: tokens.accessToken);
    await _storage.write(key: _kRefresh, value: tokens.refreshToken);
    await _storage.write(key: _kId, value: tokens.idToken);
    await _storage.write(
      key: _kExpiresAt,
      value: tokens.accessTokenExpiresAt.toUtc().toIso8601String(),
    );
  }

  @override
  Future<void> clear() async {
    await _storage.delete(key: _kAccess);
    await _storage.delete(key: _kRefresh);
    await _storage.delete(key: _kId);
    await _storage.delete(key: _kExpiresAt);
  }
}
