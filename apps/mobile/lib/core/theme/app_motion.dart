import 'package:flutter/animation.dart';

/// Motion tokens for NihonGo BJT.
///
/// Motion is purposeful and calm — used for state changes, tab transitions and
/// press feedback, never decoration. Honour reduced-motion at call sites via
/// `MediaQuery.disableAnimationsOf(context)` (drop or shorten non-essential
/// animation).
abstract final class AppMotion {
  /// Quick feedback (press, small fades): 150ms.
  static const Duration fast = Duration(milliseconds: 150);

  /// Default transition (most state changes): 250ms.
  static const Duration base = Duration(milliseconds: 250);

  /// Larger, more deliberate transitions: 400ms.
  static const Duration slow = Duration(milliseconds: 400);

  /// Standard easing for entering/most transitions.
  static const Curve standard = Curves.easeOutCubic;

  /// Easing for emphasized, springy press feedback.
  static const Curve emphasized = Curves.easeOutBack;
}
