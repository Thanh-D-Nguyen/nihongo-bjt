import 'package:flutter/material.dart';

/// NihonGo BJT brand color tokens.
///
/// Source of truth: `DESIGN.md`. Do not hardcode hex values elsewhere — read
/// from this palette so the design system stays consistent.
abstract final class AppColors {
  // Brand — Navy (primary CTA, headers, authoritative actions).
  static const Color navy = Color(0xFF1B2A4A);
  static const Color navyHover = Color(0xFF243560);
  static const Color navyPressed = Color(0xFF141F38);

  // Interactive accent — Blue (links, secondary CTA, focus rings).
  static const Color blue = Color(0xFF3B82F6);

  // Neutrals.
  static const Color canvas = Color(0xFFF8FAFC);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceHover = Color(0xFFF1F5F9);
  static const Color ink = Color(0xFF111827);
  static const Color inkSecondary = Color(0xFF4B5563);
  static const Color inkTertiary = Color(0xFF9CA3AF);
  static const Color border = Color(0xFFE2E8F0);

  // Status.
  static const Color success = Color(0xFF059669);
  static const Color warning = Color(0xFFD97706);
  static const Color danger = Color(0xFFDC2626);
}
