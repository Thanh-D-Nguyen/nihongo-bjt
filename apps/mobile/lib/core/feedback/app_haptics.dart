import 'dart:async';

import 'package:flutter/services.dart';

/// Centralized, gated haptic feedback for KotobaWorks.
///
/// Haptics are reinforcement only — state is always understandable without
/// them. Every call is a no-op when [enabled] is `false` (driven by the
/// learner's `hapticsEnabled` setting, kept in sync at the app root). Calls are
/// fire-and-forget so they never block the UI, and they degrade safely on
/// devices without a vibrator.
///
/// Allowed moments and intensities are defined in
/// `docs/mobile/MOBILE_HAPTIC_SOUND_POLICY.md`. Do not add haptics to routine
/// taps, scrolling, typing, or loading.
abstract final class AppHaptics {
  /// Whether haptics fire. Mirrors the persisted `hapticsEnabled` setting; set
  /// once at startup and whenever the setting changes. Defaults to `true`.
  static bool enabled = true;

  /// Light, discrete tick — answer/flashcard selection, SRS grade, tab change.
  static void selection() {
    if (!enabled) return;
    unawaited(HapticFeedback.selectionClick());
  }

  /// Light impact — answer submitted, correct answer, validation error.
  static void light() {
    if (!enabled) return;
    unawaited(HapticFeedback.lightImpact());
  }

  /// Medium impact — incorrect answer, lesson/review completion. Reserved for
  /// moments that deserve a touch more weight; never repeated rapidly.
  static void medium() {
    if (!enabled) return;
    unawaited(HapticFeedback.mediumImpact());
  }
}
