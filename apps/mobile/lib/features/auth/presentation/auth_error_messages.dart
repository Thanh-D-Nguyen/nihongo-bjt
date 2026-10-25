import 'package:nihongo_bjt/features/auth/domain/auth_repository.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

/// Maps a sign-in failure to safe, localized copy.
///
/// Only stable [AuthFailureCode] values are translated. Unknown errors fall back
/// to the generic message so raw exception text, tokens or HTTP bodies never
/// reach the screen.
String authErrorMessage(AppLocalizations l10n, Object error) {
  if (error is! AuthException) return l10n.loginGenericError;
  return switch (error.code) {
    AuthFailureCode.cancelled => l10n.loginCancelledError,
    AuthFailureCode.invalidCredentials => l10n.loginWrongCredentialsError,
    AuthFailureCode.methodNotAllowed => l10n.loginMethodNotAllowedError,
    AuthFailureCode.invalidScope => l10n.loginInvalidScopeError,
    AuthFailureCode.clientMisconfigured => l10n.loginClientMisconfiguredError,
    AuthFailureCode.network => l10n.loginNetworkError,
    AuthFailureCode.missingToken => l10n.loginMissingTokenError,
    AuthFailureCode.invalidRequest => l10n.loginInvalidRequestError,
    AuthFailureCode.invalidGoogleCredential =>
      l10n.loginGoogleCredentialError,
    AuthFailureCode.googleAccountConflict =>
      l10n.loginGoogleAccountConflictError,
    AuthFailureCode.rateLimited => l10n.loginRateLimitedError,
    AuthFailureCode.serverError => l10n.loginServerError,
    AuthFailureCode.serviceUnavailable => l10n.loginServiceUnavailableError,
    AuthFailureCode.unknown => l10n.loginGenericError,
  };
}
