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
  Future<void> signOut(String sessionToken) async {
    final uri = Uri.parse('${environment.apiBaseUrl}/api/auth/logout');
    try {
      await (httpClient?.post ?? http.post)(
        uri,
        headers: {
          'accept': 'application/json',
          'authorization': 'Bearer $sessionToken',
        },
      );
    } on Exception {
      // Best-effort remote logout; the caller always clears local storage.
    }
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
