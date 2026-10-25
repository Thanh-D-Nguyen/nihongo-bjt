import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:nihongo_bjt/core/config/app_environment.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_repository.dart';

/// Obtains a Google-signed ID token for the native sign-in exchange.
///
/// The ID token is a short-lived credential used only to call
/// POST /api/auth/google. It is never the app session and is never stored.
abstract interface class GoogleIdTokenSource {
  /// Returns a non-empty Google ID token.
  ///
  /// Throws [AuthException]. [AuthFailureCode.cancelled] means the user
  /// dismissed the account picker; other codes describe SDK or configuration
  /// failures.
  Future<String> fetchIdToken();
}

/// Maps a `google_sign_in` failure to the app's stable [AuthException] codes.
///
/// The SDK description is kept only as diagnostic [AuthException.cause]; it
/// never contains a token.
AuthException authExceptionForGoogleSignIn(GoogleSignInException error) {
  final code = switch (error.code) {
    GoogleSignInExceptionCode.canceled => AuthFailureCode.cancelled,
    GoogleSignInExceptionCode.interrupted => AuthFailureCode.unknown,
    GoogleSignInExceptionCode.clientConfigurationError ||
    GoogleSignInExceptionCode.providerConfigurationError =>
      AuthFailureCode.clientMisconfigured,
    GoogleSignInExceptionCode.uiUnavailable ||
    GoogleSignInExceptionCode.userMismatch ||
    GoogleSignInExceptionCode.unknownError =>
      AuthFailureCode.unknown,
  };
  return AuthException(
    'google sign-in failed: ${error.code.name}',
    code: code,
    cause: error,
  );
}

/// [GoogleIdTokenSource] backed by the official `google_sign_in` 7.x SDK.
///
/// The server verifies the token against the Web OAuth client ID, so that ID is
/// passed as `serverClientId` on every platform. On iOS the iOS client ID is
/// passed as `clientId`; on Android the SDK reads its registration from the
/// app's signing configuration.
class GoogleSignInIdTokenSource implements GoogleIdTokenSource {
  GoogleSignInIdTokenSource(this._environment);

  final AppEnvironment _environment;
  Future<void>? _initialization;

  @override
  Future<String> fetchIdToken() async {
    if (!_environment.googleSignInEnabled) {
      throw const AuthException(
        'google sign-in has no server client id configured',
        code: AuthFailureCode.clientMisconfigured,
      );
    }
    try {
      await _ensureInitialized();
      final account = await GoogleSignIn.instance.authenticate(
        scopeHint: const ['email'],
      );
      final idToken = account.authentication.idToken;
      if (idToken == null || idToken.isEmpty) {
        throw const AuthException(
          'google sign-in returned no id token',
          code: AuthFailureCode.missingToken,
        );
      }
      return idToken;
    } on GoogleSignInException catch (error) {
      throw authExceptionForGoogleSignIn(error);
    }
  }

  /// Initializes the SDK once. A failed initialization is not cached, so the
  /// next attempt retries it.
  Future<void> _ensureInitialized() {
    final pending = _initialization;
    if (pending != null) return pending;

    final iosClientId = _environment.googleIosClientId.trim();
    final clientId = defaultTargetPlatform == TargetPlatform.iOS &&
            iosClientId.isNotEmpty
        ? iosClientId
        : null;
    final initialization = GoogleSignIn.instance.initialize(
      clientId: clientId,
      serverClientId: _environment.googleServerClientId.trim(),
    );
    _initialization = initialization.catchError((
      Object error,
      StackTrace stackTrace,
    ) {
      _initialization = null;
      Error.throwWithStackTrace(error, stackTrace);
    });
    return _initialization!;
  }
}
