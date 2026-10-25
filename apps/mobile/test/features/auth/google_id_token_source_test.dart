import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:nihongo_bjt/features/auth/data/google_id_token_source.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_repository.dart';
import 'package:nihongo_bjt/features/auth/presentation/auth_error_messages.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

void main() {
  test('Google SDK cancellation becomes a silent app cancellation', () {
    final failure = authExceptionForGoogleSignIn(
      const GoogleSignInException(code: GoogleSignInExceptionCode.canceled),
    );
    expect(failure.code, AuthFailureCode.cancelled);
  });

  test('Google SDK invalid native client configuration is recognized', () {
    final failure = authExceptionForGoogleSignIn(
      const GoogleSignInException(
        code: GoogleSignInExceptionCode.clientConfigurationError,
      ),
    );
    expect(failure.code, AuthFailureCode.clientMisconfigured);
  });

  test('Google auth errors are localized separately for Vietnamese and Japanese', () async {
    const failure = AuthException(
      'must not leak raw Google SDK errors',
      code: AuthFailureCode.googleAccountConflict,
    );
    final vi = await AppLocalizations.delegate.load(const Locale('vi'));
    final ja = await AppLocalizations.delegate.load(const Locale('ja'));
    expect(authErrorMessage(vi, failure), vi.loginGoogleAccountConflictError);
    expect(authErrorMessage(ja, failure), ja.loginGoogleAccountConflictError);
    expect(authErrorMessage(vi, failure), isNot(contains('SDK')));
    expect(authErrorMessage(ja, failure), isNot(contains('SDK')));
    expect(authErrorMessage(vi, failure), isNot(authErrorMessage(ja, failure)));
  });
}

