/// Coarse authentication state used by the router and UI.
enum AuthStatus {
  /// Session is being restored from secure storage; outcome not yet known.
  unknown,

  /// A valid (or refreshable) session exists.
  authenticated,

  /// No valid session; the user must sign in.
  unauthenticated,
}
