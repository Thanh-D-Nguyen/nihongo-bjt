import 'package:flutter/foundation.dart';
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

  test('Google sign-in stays disabled without a Web client ID', () {
    final env = AppEnvironment.fromDartDefine();

    expect(env.googleServerClientId, isEmpty);
    expect(env.googleSignInEnabled, isFalse);
  });

  test('a Web client ID enables Google sign-in', () {
    const env = AppEnvironment(
      apiBaseUrl: 'https://api.test',
      flashcardDataSource: 'api',
      googleServerClientId: 'web-client.apps.googleusercontent.com',
    );

    expect(env.googleSignInEnabled, isTrue);
  });

  test('iOS only shows Google sign-in when its own client is configured', () {
    debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
    addTearDown(() => debugDefaultTargetPlatformOverride = null);
    const webOnly = AppEnvironment(
      apiBaseUrl: 'https://api.test',
      flashcardDataSource: 'api',
      googleServerClientId: 'web.apps.googleusercontent.com',
    );
    expect(webOnly.googleSignInEnabled, isFalse);
    const both = AppEnvironment(
      apiBaseUrl: 'https://api.test',
      flashcardDataSource: 'api',
      googleServerClientId: 'web.apps.googleusercontent.com',
      googleIosClientId: 'ios.apps.googleusercontent.com',
    );
    expect(both.googleSignInEnabled, isTrue);
  });
}
