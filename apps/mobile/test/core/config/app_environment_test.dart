import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/config/app_environment.dart';

void main() {
  test('fromDartDefine falls back to the local dev API base URL', () {
    final env = AppEnvironment.fromDartDefine();

    expect(env.apiBaseUrl, 'http://localhost:4000');
  });

  test('the default base URL has no trailing slash', () {
    final env = AppEnvironment.fromDartDefine();

    expect(env.apiBaseUrl.endsWith('/'), isFalse);
  });

  test('fromDartDefine provides local OIDC defaults', () {
    final env = AppEnvironment.fromDartDefine();

    expect(env.keycloakIssuer, 'http://localhost:8080/realms/nihongo-bjt');
    expect(env.oauthClientId, 'nihongo-mobile');
    expect(env.oauthRedirectUri, 'com.nihongobjt.app://oauth2redirect');
    expect(env.allowInsecureAuthConnections, isTrue);
    expect(AppEnvironment.oauthScopes, contains('offline_access'));
  });
}
