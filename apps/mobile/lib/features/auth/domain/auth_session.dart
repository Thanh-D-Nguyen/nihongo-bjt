import 'package:nihongo_bjt/features/auth/domain/auth_status.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_tokens.dart';

/// Immutable snapshot of the authentication state exposed to the UI/router.
///
/// [tokens] is non-null only when [status] is [AuthStatus.authenticated].
class AuthSession {
  const AuthSession._(this.status, this.tokens);

  /// Initial state while the stored session is being restored.
  const AuthSession.unknown() : this._(AuthStatus.unknown, null);

  /// No valid session; the user must sign in.
  const AuthSession.unauthenticated()
    : this._(AuthStatus.unauthenticated, null);

  /// A valid session backed by [tokens].
  const AuthSession.authenticated(AuthTokens tokens)
    : this._(AuthStatus.authenticated, tokens);

  /// Coarse status for routing decisions.
  final AuthStatus status;

  /// Active tokens, or `null` when not authenticated.
  final AuthTokens? tokens;

  /// Whether a usable session exists.
  bool get isAuthenticated => status == AuthStatus.authenticated;
}
