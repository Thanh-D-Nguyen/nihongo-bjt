import 'package:nihongo_bjt/features/auth/domain/auth_status.dart';

/// Path of the sign-in screen.
const String loginLocation = '/login';

/// Pure routing guard: decides where to send the user given the current auth
/// [status] and the requested [location].
///
/// Returns the path to redirect to, or `null` to allow the requested location.
/// While [AuthStatus.unknown] (session still restoring) no redirect happens so
/// the app does not flash the login screen before restore completes.
String? authRedirect({
  required AuthStatus status,
  required String location,
}) {
  if (status == AuthStatus.unknown) return null;

  final onLogin = location == loginLocation;

  if (status == AuthStatus.unauthenticated) {
    return onLogin ? null : loginLocation;
  }

  // Authenticated: keep the user out of the login screen.
  return onLogin ? '/' : null;
}
