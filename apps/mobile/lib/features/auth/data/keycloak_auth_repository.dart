import 'dart:convert';

import 'package:flutter_appauth/flutter_appauth.dart';
import 'package:http/http.dart' as http;
import 'package:nihongo_bjt/core/config/app_environment.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_repository.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_tokens.dart';

/// [AuthRepository] implemented with Keycloak.
///
/// Browser sign-in uses Authorization Code + PKCE via AppAuth. The first-party
/// email/password form uses the mobile public client's password grant, which is
/// enabled for local/dev Keycloak and returns the same token shape.
class KeycloakAuthRepository implements AuthRepository {
  const KeycloakAuthRepository({
    required this.appAuth,
    required this.environment,
    this.httpClient,
    this.now,
  });

  final FlutterAppAuth appAuth;
  final AppEnvironment environment;
  final http.Client? httpClient;
  final DateTime Function()? now;

  @override
  Future<AuthTokens> signIn({
    String? idpHint,
    AuthBrowserFlow flow = AuthBrowserFlow.signIn,
  }) async {
    final AuthorizationTokenResponse response;
    try {
      response = await appAuth.authorizeAndExchangeCode(
        AuthorizationTokenRequest(
          environment.oauthClientId,
          environment.oauthRedirectUri,
          issuer: environment.keycloakIssuer,
          scopes: AppEnvironment.oauthScopes,
          allowInsecureConnections: environment.allowInsecureAuthConnections,
          additionalParameters: _browserParameters(
            idpHint: idpHint,
            flow: flow,
          ),
        ),
      );
    } on FlutterAppAuthUserCancelledException catch (error) {
      throw AuthException(
        'browser sign-in cancelled',
        code: AuthFailureCode.cancelled,
        cause: error,
      );
    } on Exception catch (error) {
      throw AuthException(
        'browser sign-in failed',
        cause: error,
      );
    }
    return _toTokens(response, operation: 'browser sign-in');
  }

  Map<String, String>? _browserParameters({
    required String? idpHint,
    required AuthBrowserFlow flow,
  }) {
    final parameters = <String, String>{};
    if (idpHint != null) parameters['kc_idp_hint'] = idpHint;
    if (flow == AuthBrowserFlow.register) parameters['kc_action'] = 'register';
    return parameters.isEmpty ? null : parameters;
  }

  @override
  Future<AuthTokens> signInWithPassword({
    required String username,
    required String password,
  }) async {
    final networkErrors = <Object>[];
    for (final uri in _passwordTokenUris()) {
      final http.Response response;
      try {
        response = await (httpClient?.post ?? http.post)(
          uri,
          headers: const {'content-type': 'application/x-www-form-urlencoded'},
          body: {
            'grant_type': 'password',
            'client_id': environment.oauthClientId,
            'username': username,
            'password': password,
            'scope': AppEnvironment.oauthScopes.join(' '),
          },
        );
      } on Exception catch (error) {
        networkErrors.add(error);
        continue;
      }

      final json = _decodeBody(response);
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw _exceptionForTokenError(json, response.statusCode);
      }

      return _tokensFromJson(json, operation: 'password sign-in');
    }

    throw AuthException(
      'password sign-in network failure',
      code: AuthFailureCode.network,
      cause: networkErrors.isEmpty ? null : networkErrors.last,
    );
  }

  Iterable<Uri> _passwordTokenUris() sync* {
    final primary = Uri.parse(
      '${environment.keycloakIssuer}/protocol/openid-connect/token',
    );
    yield primary;

    final fallback = _androidEmulatorLoopbackAlias(primary);
    if (fallback != null) yield fallback;
  }

  /// Android emulator cannot reach host services through `localhost`; the host
  /// loopback is exposed as `10.0.2.2`. Keep the configured issuer primary so
  /// iOS simulator/desktop/dev proxy setups continue to work, then retry only
  /// after a network failure.
  Uri? _androidEmulatorLoopbackAlias(Uri uri) {
    if (uri.scheme != 'http') return null;
    if (uri.host != 'localhost' &&
        uri.host != '127.0.0.1' &&
        uri.host != '::1') {
      return null;
    }
    return uri.replace(host: '10.0.2.2');
  }

  @override
  Future<AuthTokens> refresh(String refreshToken) async {
    final TokenResponse response;
    try {
      response = await appAuth.token(
        TokenRequest(
          environment.oauthClientId,
          environment.oauthRedirectUri,
          issuer: environment.keycloakIssuer,
          refreshToken: refreshToken,
          scopes: AppEnvironment.oauthScopes,
          allowInsecureConnections: environment.allowInsecureAuthConnections,
        ),
      );
    } on Exception catch (error) {
      throw AuthException(
        'refresh failed',
        cause: error,
      );
    }
    return _toTokens(response, operation: 'refresh');
  }

  @override
  Future<void> signOut({String? idToken}) async {
    // Sign-out is intentionally local-only: we do NOT launch the OIDC
    // end-session flow (`appAuth.endSession`), because that opens the system
    // browser onto the raw Keycloak logout page — a jarring, off-brand
    // experience for a native app. The caller (AuthController) clears the
    // encrypted token store immediately, so the access/refresh/id tokens are
    // destroyed on-device and the router redirects to Login after a brief
    // "signing out" state. The IdP's own session cookie (only relevant for the
    // federated Google path) expires server-side on its normal schedule; no
    // tokens remain on the device. This keeps logout calm and predictable and
    // never surfaces a Keycloak browser prompt.
  }

  /// Maps an AppAuth token response to [AuthTokens], failing loudly if the
  /// provider omitted a required value (never fabricates a session).
  AuthTokens _toTokens(TokenResponse response, {required String operation}) {
    final access = response.accessToken;
    final refresh = response.refreshToken;
    final id = response.idToken;
    final expiresAt = response.accessTokenExpirationDateTime;

    if (access == null || refresh == null || id == null || expiresAt == null) {
      throw AuthException(
        'auth response missing required token fields ($operation)',
        code: AuthFailureCode.missingToken,
      );
    }

    return AuthTokens(
      accessToken: access,
      refreshToken: refresh,
      idToken: id,
      accessTokenExpiresAt: expiresAt.toUtc(),
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

  AuthException _exceptionForTokenError(
    Map<String, Object?> body,
    int statusCode,
  ) {
    final error = body['error'];
    final description = body['error_description'];
    final details = '$error $description'.toLowerCase();

    if (error == 'invalid_grant') {
      return const AuthException(
        'invalid username or password',
        code: AuthFailureCode.invalidCredentials,
      );
    }
    if (error == 'invalid_scope') {
      return const AuthException(
        'invalid auth scope',
        code: AuthFailureCode.invalidScope,
      );
    }
    if (details.contains('not allowed') ||
        details.contains('direct grant') ||
        details.contains('password grant')) {
      return const AuthException(
        'password sign-in is not allowed for this client',
        code: AuthFailureCode.methodNotAllowed,
      );
    }
    if (error == 'unauthorized_client' ||
        error == 'invalid_client' ||
        statusCode == 401) {
      return const AuthException(
        'auth client is misconfigured',
        code: AuthFailureCode.clientMisconfigured,
      );
    }
    return AuthException(
      'token endpoint failed with HTTP $statusCode',
    );
  }

  AuthTokens _tokensFromJson(
    Map<String, Object?> body, {
    required String operation,
  }) {
    final access = body['access_token'];
    final refresh = body['refresh_token'];
    final id = body['id_token'];
    final expiresIn = body['expires_in'];
    if (access is! String || refresh is! String || id is! String) {
      throw AuthException(
        'auth response missing required token fields ($operation)',
        code: AuthFailureCode.missingToken,
      );
    }
    final expiresInSeconds = expiresIn is int
        ? expiresIn
        : int.tryParse(expiresIn.toString());
    if (expiresInSeconds == null || expiresInSeconds <= 0) {
      throw AuthException(
        'auth response missing token expiry ($operation)',
        code: AuthFailureCode.missingToken,
      );
    }

    final issuedAt = (now ?? DateTime.now)().toUtc();
    return AuthTokens(
      accessToken: access,
      refreshToken: refresh,
      idToken: id,
      accessTokenExpiresAt: issuedAt.add(Duration(seconds: expiresInSeconds)),
    );
  }
}
