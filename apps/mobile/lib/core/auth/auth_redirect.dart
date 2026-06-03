import 'package:nihongo_bjt/features/auth/domain/auth_status.dart';

/// Path of the sign-in screen.
const String loginLocation = '/login';

/// Path of the account-creation screen.
const String registerLocation = '/register';

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
  final onRegister = location == registerLocation;

  if (status == AuthStatus.unauthenticated) {
    // Both auth entry points are reachable while signed out.
    return (onLogin || onRegister) ? null : loginLocation;
  }

  // Authenticated: keep the user away from the auth entry points.
  return (onLogin || onRegister) ? '/' : null;
}
