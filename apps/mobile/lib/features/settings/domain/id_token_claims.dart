import 'dart:convert';

import 'package:meta/meta.dart';

/// Human-readable identity claims decoded from an OIDC ID token, for display on
/// the profile screen.
///
/// Only non-sensitive display fields are surfaced — never the raw token. The
/// ID token is the learner's own token, signed by Keycloak; decoding its
/// payload locally is standard OIDC practice and avoids inventing a display
/// name. No signature verification is done here (the token already authorised
/// the session); these values are for display only and are never trusted for
/// authorization.
@immutable
class IdTokenClaims {
  const IdTokenClaims({this.name, this.preferredUsername, this.email});

  /// Decodes the payload of a JWT [idToken]. Returns [empty] for any malformed
  /// input — a bad/absent token must never throw on the profile screen.
  factory IdTokenClaims.fromIdToken(String? idToken) {
    if (idToken == null || idToken.isEmpty) return empty;
    final parts = idToken.split('.');
    if (parts.length != 3) return empty;
    try {
      final payload = utf8.decode(
        base64Url.decode(base64Url.normalize(parts[1])),
      );
      final decoded = jsonDecode(payload);
      if (decoded is! Map<String, dynamic>) return empty;
      return IdTokenClaims(
        name: _readString(decoded['name']),
        preferredUsername: _readString(decoded['preferred_username']),
        email: _readString(decoded['email']),
      );
    } on Object {
      return empty;
    }
  }

  /// Empty claims (nothing could be decoded / no session).
  static const IdTokenClaims empty = IdTokenClaims();

  /// Full display name (`name` claim), when present.
  final String? name;

  /// Login/username (`preferred_username` claim), when present.
  final String? preferredUsername;

  /// Email (`email` claim), when present.
  final String? email;

  /// Whether no identity claim could be decoded (e.g. no authenticated
  /// session). Equivalent to [empty].
  bool get isEmpty =>
      name == null && preferredUsername == null && email == null;

  /// Best available display label: name → username → email → `null`.
  String? get displayName => _firstNonBlank([name, preferredUsername, email]);

  /// A secondary line distinct from [displayName]: prefers email, else
  /// username, avoiding repeating the primary label.
  String? get secondaryLabel {
    final primary = displayName;
    return _firstNonBlank(
      [email, preferredUsername].where((value) => value != primary).toList(),
    );
  }

  static String? _readString(Object? value) {
    if (value is String && value.trim().isNotEmpty) return value.trim();
    return null;
  }

  static String? _firstNonBlank(List<String?> candidates) {
    for (final value in candidates) {
      if (value != null && value.trim().isNotEmpty) return value.trim();
    }
    return null;
  }

  @override
  bool operator ==(Object other) =>
      other is IdTokenClaims &&
      other.name == name &&
      other.preferredUsername == preferredUsername &&
      other.email == email;

  @override
  int get hashCode => Object.hash(name, preferredUsername, email);
}
