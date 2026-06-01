import 'package:flutter_appauth/flutter_appauth.dart';
import 'package:nihongo_bjt/core/config/app_environment.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_repository.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_tokens.dart';

/// [AuthRepository] implemented with `flutter_appauth` against a Keycloak
/// realm using OIDC Authorization Code + PKCE (PKCE handled natively by
/// AppAuth). All endpoints are discovered from the realm issuer.
class KeycloakAuthRepository implements AuthRepository {
  const KeycloakAuthRepository({
    required this.appAuth,
    required this.environment,
  });

  final FlutterAppAuth appAuth;
  final AppEnvironment environment;

  @override
  Future<AuthTokens> signIn({String? idpHint}) async {
    final AuthorizationTokenResponse response;
    try {
      response = await appAuth.authorizeAndExchangeCode(
        AuthorizationTokenRequest(
          environment.oauthClientId,
          environment.oauthRedirectUri,
          issuer: environment.keycloakIssuer,
          scopes: AppEnvironment.oauthScopes,
          allowInsecureConnections: environment.allowInsecureAuthConnections,
          additionalParameters: idpHint == null
              ? null
              : {'kc_idp_hint': idpHint},
        ),
      );
    } on FlutterAppAuthUserCancelledException catch (error) {
      throw AuthException('Đăng nhập đã bị huỷ.', cause: error);
    } on Exception catch (error) {
      throw AuthException(
        'Không thể đăng nhập. Vui lòng thử lại.',
        cause: error,
      );
    }
    return _toTokens(response, operation: 'sign-in');
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
      throw AuthException('Phiên đăng nhập đã hết hạn.', cause: error);
    }
    return _toTokens(response, operation: 'refresh');
  }

  @override
  Future<void> signOut({String? idToken}) async {
    // The provider end-session call requires either both id_token_hint and a
    // post-logout redirect, or neither. When no id token is available, the
    // local session is cleared by the caller and no remote call is made.
    if (idToken == null) return;
    try {
      await appAuth.endSession(
        EndSessionRequest(
          idTokenHint: idToken,
          postLogoutRedirectUrl: environment.oauthRedirectUri,
          issuer: environment.keycloakIssuer,
          allowInsecureConnections: environment.allowInsecureAuthConnections,
        ),
      );
    } on Exception catch (error) {
      throw AuthException('Không thể đăng xuất hoàn toàn.', cause: error);
    }
  }

  /// Maps an AppAuth token response to [AuthTokens], failing loudly if the
  /// provider omitted a required value (never fabricates a session).
  AuthTokens _toTokens(TokenResponse response, {required String operation}) {
    final access = response.accessToken;
    final refresh = response.refreshToken;
    final id = response.idToken;
    final expiresAt = response.accessTokenExpirationDateTime;

    if (access == null || refresh == null || id == null || expiresAt == null) {
      throw AuthException('Phản hồi xác thực thiếu dữ liệu ($operation).');
    }

    return AuthTokens(
      accessToken: access,
      refreshToken: refresh,
      idToken: id,
      accessTokenExpiresAt: expiresAt.toUtc(),
    );
  }
}
