/// Corner radius tokens from `DESIGN.md`.
///
/// `md` is the default for buttons and inputs; `lg` is for cards. Smaller and
/// larger steps are added when a consumer needs them.
abstract final class AppRadius {
  /// Chips, inputs, compact controls.
  static const double sm = 8;

  /// Default for buttons and inputs.
  static const double md = 10;

  /// Cards and grouped surfaces.
  static const double lg = 14;

  /// Large surfaces and bottom sheets.
  static const double xl = 20;

  /// Fully rounded (pills, avatars).
  static const double pill = 999;
}
