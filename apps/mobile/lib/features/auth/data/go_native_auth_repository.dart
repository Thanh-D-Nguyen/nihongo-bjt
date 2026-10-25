import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:nihongo_bjt/core/config/app_environment.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_repository.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_tokens.dart';

/// [AuthRepository] backed by the Go-native session token API.
///
/// Login returns an opaque session token in the JSON body
/// (`{"ok":true,"token":"..."}`). The token is sent as
/// `Authorization: Bearer <token>` on every subsequent call. Session expiry
/// is server-side (24h default); when expired the user re-authenticates.
class GoNativeAuthRepository implements AuthRepository {
  const GoNativeAuthRepository({
    required this.environment,
    this.httpClient,
    this.now,
  });

  /// Upper bound for one auth request so the sign-in spinner cannot hang.
  static const Duration _requestTimeout = Duration(seconds: 15);

  final AppEnvironment environment;
  final http.Client? httpClient;
  final DateTime Function()? now;

  @override
  Future<AuthTokens> signInWithPassword({
    required String username,
    required String password,
  }) async {
    final uri = Uri.parse('${environment.apiBaseUrl}/api/auth/login');
    final http.Response response;
    try {
      response = await (httpClient?.post ?? http.post)(
        uri,
        headers: const {'content-type': 'application/json'},
        body: jsonEncode({
          'email': username.trim().toLowerCase(),
          'password': password,
        }),
      );
    } on Exception catch (error) {
      throw AuthException(
        'login network failure',
        code: AuthFailureCode.network,
        cause: error,
      );
    }

    final body = _decodeBody(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw _exceptionForLoginError(body, response.statusCode);
    }

    return _sessionTokensFrom(body);
  }

  @override
  Future<AuthTokens> signInWithGoogle({required String idToken}) async {
    final uri = Uri.parse('${environment.apiBaseUrl}/api/auth/google');
    final http.Response response;
    try {
      // Native requests carry no Origin header; this route is intentionally
      // outside the CSRF guard (see server.go) and relies on the Google-signed
      // ID token instead. The ID token is only sent in the body, never a header
      // or log line.
      response = await (httpClient?.post ?? http.post)(
        uri,
        headers: const {
          'accept': 'application/json',
          'content-type': 'application/json',
        },
        body: jsonEncode({'idToken': idToken}),
      ).timeout(_requestTimeout);
    } on Exception catch (error) {
      throw AuthException(
        'google login network failure',
        code: AuthFailureCode.network,
        cause: error,
      );
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw _exceptionForGoogleError(response.statusCode);
    }
    return _sessionTokensFrom(_decodeBody(response));
  }

  @override
  Future<bool> validateSession(String sessionToken) async {
    final uri = Uri.parse('${environment.apiBaseUrl}/api/auth/me');
    final http.Response response;
    try {
      response = await (httpClient?.get ?? http.get)(
        uri,
        headers: {
          'accept': 'application/json',
          'authorization': 'Bearer $sessionToken',
        },
      );
    } on Exception {
      return false;
    }
    return response.statusCode >= 200 && response.statusCode < 300;
  }

  @override
  Future<bool> signOut(String sessionToken) async {
    final uri = Uri.parse('${environment.apiBaseUrl}/api/auth/logout');
    try {
      final response = await (httpClient?.post ?? http.post)(
        uri,
        headers: {
          'accept': 'application/json',
          'authorization': 'Bearer $sessionToken',
        },
      ).timeout(_requestTimeout);
      // The logout route sits behind the CSRF guard, so a native client without
      // an allowlisted Origin receives 403 and the session stays live server-side
      // until it expires. The caller reports that; local credentials are cleared
      // regardless.
      return response.statusCode >= 200 && response.statusCode < 300;
    } on Exception {
      return false;
    }
  }

  /// Parses `{"token": "..."}` from a successful login or Google response.
  AuthTokens _sessionTokensFrom(Map<String, Object?> body) {
    final token = body['token'];
    if (token is! String || token.isEmpty) {
      throw const AuthException(
        'login response missing session token',
        code: AuthFailureCode.missingToken,
      );
    }

    // Default session TTL matches the Go API (24h). The server may return a
    // custom TTL in the future; for now we use a fixed 24h window with a 30s
    // early-expiry buffer built into AuthTokens.isExpired.
    final issuedAt = (now ?? DateTime.now)().toUtc();
    return AuthTokens(
      sessionToken: token,
      expiresAt: issuedAt.add(const Duration(hours: 24)),
    );
  }

  Map<String, Object?> _decodeBody(http.Response response) {
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, Object?>) return decoded;
    } on Object {
      // Status code still drives the failure category.
    }
    return const {};
  }

  /// Maps the documented POST /api/auth/google failure statuses to stable
  /// categories. The response body is never copied into the exception.
  AuthException _exceptionForGoogleError(int statusCode) {
    return switch (statusCode) {
      400 => const AuthException(
          'google login request rejected',
          code: AuthFailureCode.invalidRequest,
        ),
      401 => const AuthException(
          'google credential rejected',
          code: AuthFailureCode.invalidGoogleCredential,
        ),
      409 => const AuthException(
          'google email belongs to another learner account',
          code: AuthFailureCode.googleAccountConflict,
        ),
      429 => const AuthException(
          'google login rate limited',
          code: AuthFailureCode.rateLimited,
        ),
      503 => const AuthException(
          'google login not configured on the server',
          code: AuthFailureCode.serviceUnavailable,
        ),
      >= 500 => const AuthException(
          'google login server error',
          code: AuthFailureCode.serverError,
        ),
      _ => AuthException(
          'google login failed with HTTP $statusCode',
        ),
    };
  }

  AuthException _exceptionForLoginError(
    Map<String, Object?> body,
    int statusCode,
  ) {
    final error = body['error']?.toString() ?? '';

    if (statusCode == 401 || error == 'invalid_credentials') {
      return const AuthException(
        'invalid username or password',
        code: AuthFailureCode.invalidCredentials,
      );
    }
    if (statusCode == 400 && error == 'validation') {
      return const AuthException(
        'invalid login request',
        code: AuthFailureCode.invalidCredentials,
      );
    }
    if (statusCode == 404 || statusCode == 503) {
      return const AuthException(
        'authentication service unavailable',
        code: AuthFailureCode.methodNotAllowed,
      );
    }
    return AuthException('login failed with HTTP $statusCode');
  }
}
