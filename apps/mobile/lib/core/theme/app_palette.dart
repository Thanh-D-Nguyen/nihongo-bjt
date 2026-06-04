import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/theme/app_colors.dart';

/// Theme-aware semantic color roles for KotobaWorks.
///
/// [AppColors] holds raw brand constants that never change with the theme
/// (navy/blue). This [AppPalette] holds the **semantic** roles that screens and
/// components actually read — each tuned for light and dark with WCAG AA
/// contrast. Access it via `context.palette` (see [AppPaletteX]); never
/// hardcode hex values in a widget.
///
/// Registered on both [ThemeData]s as a [ThemeExtension] so the same component
/// renders correctly in light and dark mode.
@immutable
class AppPalette extends ThemeExtension<AppPalette> {
  const AppPalette({
    required this.canvas,
    required this.surface,
    required this.surfaceHover,
    required this.surfaceMuted,
    required this.border,
    required this.ink,
    required this.inkSecondary,
    required this.inkTertiary,
    required this.accent,
    required this.accentSoft,
    required this.success,
    required this.successSoft,
    required this.warning,
    required this.warningSoft,
    required this.danger,
    required this.dangerSoft,
    required this.info,
    required this.infoSoft,
    required this.premium,
    required this.premiumSoft,
    required this.skeleton,
  });

  /// App background sitting behind cards and sheets.
  final Color canvas;

  /// Card / sheet background.
  final Color surface;

  /// Subtle raised fill (pressed/hover surfaces).
  final Color surfaceHover;

  /// Muted fill for inert chips, skeleton bases, secondary surfaces.
  final Color surfaceMuted;

  /// Hairline separators and card borders.
  final Color border;

  /// Primary text / icon color.
  final Color ink;

  /// Secondary text color.
  final Color inkSecondary;

  /// Tertiary text color (captions, disabled, placeholders).
  final Color inkTertiary;

  /// Interactive accent (links, secondary CTAs, focus rings).
  final Color accent;

  /// Soft background paired with [accent] (selected chips, accent fills).
  final Color accentSoft;

  final Color success;
  final Color successSoft;
  final Color warning;
  final Color warningSoft;
  final Color danger;
  final Color dangerSoft;

  /// Informational accent (calm cyan/blue) for neutral notices — distinct from
  /// [warning] so info surfaces never read as a caution.
  final Color info;
  final Color infoSoft;

  /// Restrained gold for premium / achievement / streak. Deliberately distinct
  /// from [warning] (amber) so premium never reads as a caution state.
  final Color premium;
  final Color premiumSoft;

  /// Shimmer/placeholder base for loading skeletons.
  final Color skeleton;

  // --- Learning-state roles -------------------------------------------------
  // Semantic aliases over the base roles so screens express learning intent
  // (active/completed/due/weak/locked/recommended) without re-deriving colors.
  // Always pair with an icon + label, never color alone.

  /// In-progress lesson/unit.
  Color get learningActive => accent;
  Color get learningActiveSoft => accentSoft;

  /// Finished lesson/unit.
  Color get learningCompleted => success;
  Color get learningCompletedSoft => successSoft;

  /// Due for review.
  Color get learningDue => premium;
  Color get learningDueSoft => premiumSoft;

  /// Low mastery / needs work.
  Color get learningWeak => danger;
  Color get learningWeakSoft => dangerSoft;

  /// Not yet available.
  Color get learningLocked => inkTertiary;

  /// Suggested next step.
  Color get learningRecommended => accent;
  Color get learningRecommendedSoft => accentSoft;

  /// Light theme roles (mirror `DESIGN.md`).
  static const AppPalette light = AppPalette(
    canvas: Color(0xFFF8FAFC),
    surface: Color(0xFFFFFFFF),
    surfaceHover: Color(0xFFF1F5F9),
    surfaceMuted: Color(0xFFF1F5F9),
    border: Color(0xFFE2E8F0),
    ink: Color(0xFF111827),
    inkSecondary: Color(0xFF4B5563),
    inkTertiary: Color(0xFF9CA3AF),
    accent: AppColors.blue,
    accentSoft: Color(0xFFEFF6FF),
    success: Color(0xFF059669),
    successSoft: Color(0xFFECFDF5),
    warning: Color(0xFFD97706),
    warningSoft: Color(0xFFFFFBEB),
    danger: Color(0xFFDC2626),
    dangerSoft: Color(0xFFFEF2F2),
    info: Color(0xFF0EA5E9),
    infoSoft: Color(0xFFE0F2FE),
    premium: Color(0xFFB7791F),
    premiumSoft: Color(0xFFFDF6E3),
    skeleton: Color(0xFFE9EEF4),
  );

  /// Dark theme roles — deep navy-tinted neutrals (not pure black), lightened
  /// accent and status colors for contrast on dark surfaces.
  static const AppPalette dark = AppPalette(
    canvas: Color(0xFF0B1220),
    surface: Color(0xFF131C2E),
    surfaceHover: Color(0xFF1B2740),
    surfaceMuted: Color(0xFF1B2740),
    border: Color(0xFF25324C),
    ink: Color(0xFFF1F5F9),
    inkSecondary: Color(0xFFA6B2C6),
    inkTertiary: Color(0xFF6B7892),
    accent: Color(0xFF5B9BFF),
    accentSoft: Color(0xFF16233B),
    success: Color(0xFF34D399),
    successSoft: Color(0xFF11271F),
    warning: Color(0xFFFBBF24),
    warningSoft: Color(0xFF2A2113),
    danger: Color(0xFFF87171),
    dangerSoft: Color(0xFF2A1517),
    info: Color(0xFF38BDF8),
    infoSoft: Color(0xFF112433),
    premium: Color(0xFFE0B355),
    premiumSoft: Color(0xFF2A2413),
    skeleton: Color(0xFF1B2740),
  );

  @override
  AppPalette copyWith({
    Color? canvas,
    Color? surface,
    Color? surfaceHover,
    Color? surfaceMuted,
    Color? border,
    Color? ink,
    Color? inkSecondary,
    Color? inkTertiary,
    Color? accent,
    Color? accentSoft,
    Color? success,
    Color? successSoft,
    Color? warning,
    Color? warningSoft,
    Color? danger,
    Color? dangerSoft,
    Color? info,
    Color? infoSoft,
    Color? premium,
    Color? premiumSoft,
    Color? skeleton,
  }) {
    return AppPalette(
      canvas: canvas ?? this.canvas,
      surface: surface ?? this.surface,
      surfaceHover: surfaceHover ?? this.surfaceHover,
      surfaceMuted: surfaceMuted ?? this.surfaceMuted,
      border: border ?? this.border,
      ink: ink ?? this.ink,
      inkSecondary: inkSecondary ?? this.inkSecondary,
      inkTertiary: inkTertiary ?? this.inkTertiary,
      accent: accent ?? this.accent,
      accentSoft: accentSoft ?? this.accentSoft,
      success: success ?? this.success,
      successSoft: successSoft ?? this.successSoft,
      warning: warning ?? this.warning,
      warningSoft: warningSoft ?? this.warningSoft,
      danger: danger ?? this.danger,
      dangerSoft: dangerSoft ?? this.dangerSoft,
      info: info ?? this.info,
      infoSoft: infoSoft ?? this.infoSoft,
      premium: premium ?? this.premium,
      premiumSoft: premiumSoft ?? this.premiumSoft,
      skeleton: skeleton ?? this.skeleton,
    );
  }

  @override
  AppPalette lerp(ThemeExtension<AppPalette>? other, double t) {
    if (other is! AppPalette) return this;
    return AppPalette(
      canvas: Color.lerp(canvas, other.canvas, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      surfaceHover: Color.lerp(surfaceHover, other.surfaceHover, t)!,
      surfaceMuted: Color.lerp(surfaceMuted, other.surfaceMuted, t)!,
      border: Color.lerp(border, other.border, t)!,
      ink: Color.lerp(ink, other.ink, t)!,
      inkSecondary: Color.lerp(inkSecondary, other.inkSecondary, t)!,
      inkTertiary: Color.lerp(inkTertiary, other.inkTertiary, t)!,
      accent: Color.lerp(accent, other.accent, t)!,
      accentSoft: Color.lerp(accentSoft, other.accentSoft, t)!,
      success: Color.lerp(success, other.success, t)!,
      successSoft: Color.lerp(successSoft, other.successSoft, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      warningSoft: Color.lerp(warningSoft, other.warningSoft, t)!,
      danger: Color.lerp(danger, other.danger, t)!,
      dangerSoft: Color.lerp(dangerSoft, other.dangerSoft, t)!,
      info: Color.lerp(info, other.info, t)!,
      infoSoft: Color.lerp(infoSoft, other.infoSoft, t)!,
      premium: Color.lerp(premium, other.premium, t)!,
      premiumSoft: Color.lerp(premiumSoft, other.premiumSoft, t)!,
      skeleton: Color.lerp(skeleton, other.skeleton, t)!,
    );
  }
}

/// Ergonomic access to the active [AppPalette]: `context.palette.surface`.
extension AppPaletteX on BuildContext {
  AppPalette get palette =>
      Theme.of(this).extension<AppPalette>() ?? AppPalette.light;
}
