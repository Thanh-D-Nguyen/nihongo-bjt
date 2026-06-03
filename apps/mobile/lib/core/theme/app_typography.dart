import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/theme/app_colors.dart';

/// Type scale for NihonGo BJT, mapped onto Material's [TextTheme] slots.
///
/// Two policies live here:
/// - Latin/Vietnamese body & UI chrome use the Material [textTheme] slots.
/// - Japanese display / body / reading text use the dedicated
///   [japaneseDisplay], [japaneseBody] and [japaneseReading] tokens, which use
///   a taller line-height so kanji and kana never feel cramped.
///
/// Families follow `DESIGN.md` (Inter for Latin, Noto Sans JP for Japanese).
/// No font file is bundled yet (no licensed asset exists in the repo), so
/// [fallback] degrades gracefully: Inter for Latin glyphs, then the platform's
/// CJK font (e.g. Noto Sans JP) for Japanese, then the system default. Bundling
/// licensed assets is deferred; see the Phase 9 log for the blocker.
abstract final class AppTypography {
  static const List<String> fallback = ['Inter', 'Noto Sans JP'];

  /// Large Japanese term shown on the flashcard front.
  ///
  /// No explicit color: the term inherits the ambient `onSurface` color so it
  /// reads correctly in both light and dark themes.
  static const TextStyle japaneseDisplay = TextStyle(
    fontFamilyFallback: fallback,
    fontSize: 44,
    fontWeight: FontWeight.w700,
    height: 1.5,
  );

  /// Default Japanese running text (sentences). Line-height ≥ 1.8 per
  /// `production-first` so multi-line Japanese stays readable. Inherits the
  /// ambient `onSurface` color (theme-aware).
  static const TextStyle japaneseBody = TextStyle(
    fontFamilyFallback: fallback,
    fontSize: 18,
    fontWeight: FontWeight.w500,
    height: 1.8,
  );

  /// Reading help (kana / furigana) rendered above a Japanese term. Inherits
  /// the ambient text color (theme-aware).
  static const TextStyle japaneseReading = TextStyle(
    fontFamilyFallback: fallback,
    fontSize: 16,
    fontWeight: FontWeight.w500,
    height: 1.4,
  );

  /// Light text theme (default ink colors).
  static TextTheme get textTheme => _build(
    ink: AppColors.ink,
    secondary: AppColors.inkSecondary,
    tertiary: AppColors.inkTertiary,
  );

  /// Dark text theme — same scale, theme-appropriate ink colors so text never
  /// renders dark-on-dark.
  static TextTheme get darkTextTheme => _build(
    ink: const Color(0xFFF1F5F9),
    secondary: const Color(0xFFA6B2C6),
    tertiary: const Color(0xFF6B7892),
  );

  static TextTheme _build({
    required Color ink,
    required Color secondary,
    required Color tertiary,
  }) => TextTheme(
    headlineSmall: TextStyle(
      fontFamilyFallback: fallback,
      fontSize: 24,
      fontWeight: FontWeight.w700,
      height: 1.3,
      color: ink,
    ),
    titleLarge: TextStyle(
      fontFamilyFallback: fallback,
      fontSize: 20,
      fontWeight: FontWeight.w600,
      height: 1.35,
      color: ink,
    ),
    titleMedium: TextStyle(
      fontFamilyFallback: fallback,
      fontSize: 18,
      fontWeight: FontWeight.w600,
      height: 1.4,
      color: ink,
    ),
    bodyMedium: TextStyle(
      fontFamilyFallback: fallback,
      fontSize: 14,
      fontWeight: FontWeight.w400,
      height: 1.6,
      color: ink,
    ),
    bodySmall: TextStyle(
      fontFamilyFallback: fallback,
      fontSize: 13,
      fontWeight: FontWeight.w400,
      height: 1.5,
      color: secondary,
    ),
    labelMedium: TextStyle(
      fontFamilyFallback: fallback,
      fontSize: 12,
      fontWeight: FontWeight.w600,
      height: 1.4,
      color: secondary,
    ),
    labelSmall: TextStyle(
      fontFamilyFallback: fallback,
      fontSize: 12,
      fontWeight: FontWeight.w400,
      height: 1.4,
      color: tertiary,
    ),
  );
}
