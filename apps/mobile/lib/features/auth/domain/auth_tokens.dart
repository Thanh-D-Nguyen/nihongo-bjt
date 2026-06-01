import 'package:meta/meta.dart';

/// Immutable set of OIDC tokens for an authenticated session.
///
/// Tokens are opaque to the app and are never logged. Persistence is handled by
/// the token store; this type only models the in-memory value.
@immutable
class AuthTokens {
  const AuthTokens({
    required this.accessToken,
    required this.refreshToken,
    required this.idToken,
    required this.accessTokenExpiresAt,
  });

  /// Bearer token sent on authorized API requests.
  final String accessToken;

  /// Long-lived token used to obtain a new access token without re-login.
  final String refreshToken;

  /// OIDC ID token; used as the `id_token_hint` on sign-out.
  final String idToken;

  /// Absolute expiry of [accessToken] (UTC).
  final DateTime accessTokenExpiresAt;

  /// Treats the access token as expired slightly early so callers refresh
  /// before a request would fail with 401 due to clock skew / latency.
  bool get isAccessTokenExpired {
    final threshold = DateTime.now().toUtc().add(const Duration(seconds: 30));
    return !accessTokenExpiresAt.isAfter(threshold);
  }

  @override
  bool operator ==(Object other) {
    return other is AuthTokens &&
        other.accessToken == accessToken &&
        other.refreshToken == refreshToken &&
        other.idToken == idToken &&
        other.accessTokenExpiresAt == accessTokenExpiresAt;
  }

  @override
  int get hashCode => Object.hash(
    accessToken,
    refreshToken,
    idToken,
    accessTokenExpiresAt,
  );
}
