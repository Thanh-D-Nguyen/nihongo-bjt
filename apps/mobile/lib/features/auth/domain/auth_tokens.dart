import 'package:meta/meta.dart';

/// Immutable session credential for the Go-native session token auth.
///
/// The Go API issues an opaque session token on login. Unlike OIDC, there is
/// no refresh token or ID token — the session token is the sole credential,
/// sent as `Authorization: Bearer <token>` on every API call. Expiry is
/// server-side (24h default); when expired the user re-authenticates.
@immutable
class AuthTokens {
  const AuthTokens({
    required this.sessionToken,
    required this.expiresAt,
  });

  /// Opaque session token issued by the Go API on login.
  final String sessionToken;

  /// Absolute expiry of [sessionToken] (UTC). Derived from the server's
  /// session TTL so the client can proactively redirect to login before a
  /// 401.
  final DateTime expiresAt;

  /// Treats the session as expired slightly early so callers redirect to
  /// login before a request would fail with 401 due to clock skew / latency.
  bool get isExpired {
    final threshold =
        DateTime.now().toUtc().add(const Duration(seconds: 30));
    return !expiresAt.isAfter(threshold);
  }

  @override
  bool operator ==(Object other) {
    return other is AuthTokens &&
        other.sessionToken == sessionToken &&
        other.expiresAt == expiresAt;
  }

  @override
  int get hashCode => Object.hash(sessionToken, expiresAt);
}
