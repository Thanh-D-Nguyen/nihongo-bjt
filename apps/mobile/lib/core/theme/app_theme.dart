import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/theme/app_colors.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_typography.dart';

/// Brand light & dark themes for NihonGo BJT.
///
/// Composes the color system, type scale and shape language from `DESIGN.md`
/// and the mobile design system. Both themes register [AppPalette] as a
/// [ThemeExtension] so theme-aware components (`context.palette`) render
/// correctly in either mode. The app selects between them with
/// `ThemeMode.system`.
abstract final class AppTheme {
  static ThemeData get light => _base(
    brightness: Brightness.light,
    palette: AppPalette.light,
    textTheme: AppTypography.textTheme,
    colorScheme: const ColorScheme(
      brightness: Brightness.light,
      primary: AppColors.navy,
      onPrimary: Colors.white,
      secondary: AppColors.blue,
      onSecondary: Colors.white,
      error: AppColors.danger,
      onError: Colors.white,
      surface: AppColors.surface,
      onSurface: AppColors.ink,
    ),
  );

  static ThemeData get dark => _base(
    brightness: Brightness.dark,
    palette: AppPalette.dark,
    textTheme: AppTypography.darkTextTheme,
    colorScheme: ColorScheme(
      brightness: Brightness.dark,
      primary: AppPalette.dark.accent,
      onPrimary: AppPalette.dark.canvas,
      secondary: AppPalette.dark.accent,
      onSecondary: AppPalette.dark.canvas,
      error: AppPalette.dark.danger,
      onError: AppPalette.dark.canvas,
      surface: AppPalette.dark.surface,
      onSurface: AppPalette.dark.ink,
    ),
  );

  static ThemeData _base({
    required Brightness brightness,
    required AppPalette palette,
    required ColorScheme colorScheme,
    required TextTheme textTheme,
  }) {
    final buttonShape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(AppRadius.md),
    );
    final cardShape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(AppRadius.lg),
    );

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: palette.canvas,
      textTheme: textTheme,
      extensions: [palette],
      appBarTheme: AppBarTheme(
        backgroundColor: palette.canvas,
        surfaceTintColor: Colors.transparent,
        foregroundColor: palette.ink,
        centerTitle: false,
        elevation: 0,
        scrolledUnderElevation: 0,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(shape: buttonShape),
      ),
      cardTheme: CardThemeData(
        color: palette.surface,
        surfaceTintColor: Colors.transparent,
        shape: cardShape,
      ),
      dividerColor: palette.border,
    );
  }
}
