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
  static const TextStyle japaneseDisplay = TextStyle(
    fontFamilyFallback: fallback,
    fontSize: 44,
    fontWeight: FontWeight.w700,
    height: 1.5,
    color: AppColors.ink,
  );

  /// Default Japanese running text (sentences). Line-height ≥ 1.8 per
  /// `production-first` so multi-line Japanese stays readable.
  static const TextStyle japaneseBody = TextStyle(
    fontFamilyFallback: fallback,
    fontSize: 18,
    fontWeight: FontWeight.w500,
    height: 1.8,
    color: AppColors.ink,
  );

  /// Reading help (kana / furigana) rendered above a Japanese term.
  static const TextStyle japaneseReading = TextStyle(
    fontFamilyFallback: fallback,
    fontSize: 16,
    fontWeight: FontWeight.w500,
    height: 1.4,
    color: AppColors.inkSecondary,
  );

  static TextTheme get textTheme => const TextTheme(
    headlineSmall: TextStyle(
      fontFamilyFallback: fallback,
      fontSize: 24,
      fontWeight: FontWeight.w700,
      height: 1.3,
      color: AppColors.ink,
    ),
    titleLarge: TextStyle(
      fontFamilyFallback: fallback,
      fontSize: 20,
      fontWeight: FontWeight.w600,
      height: 1.35,
      color: AppColors.ink,
    ),
    titleMedium: TextStyle(
      fontFamilyFallback: fallback,
      fontSize: 18,
      fontWeight: FontWeight.w600,
      height: 1.4,
      color: AppColors.ink,
    ),
    bodyMedium: TextStyle(
      fontFamilyFallback: fallback,
      fontSize: 14,
      fontWeight: FontWeight.w400,
      height: 1.6,
      color: AppColors.ink,
    ),
    bodySmall: TextStyle(
      fontFamilyFallback: fallback,
      fontSize: 13,
      fontWeight: FontWeight.w400,
      height: 1.5,
      color: AppColors.inkSecondary,
    ),
    labelSmall: TextStyle(
      fontFamilyFallback: fallback,
      fontSize: 12,
      fontWeight: FontWeight.w400,
      height: 1.4,
      color: AppColors.inkTertiary,
    ),
  );
}
