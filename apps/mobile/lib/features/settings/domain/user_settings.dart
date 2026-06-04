import 'package:meta/meta.dart';
import 'package:nihongo_bjt/features/settings/domain/app_locale_option.dart';
import 'package:nihongo_bjt/features/settings/domain/app_theme_option.dart';

/// Immutable snapshot of the learner's device-scoped preferences.
///
/// Presentation preferences only (app language, appearance/theme, furigana
/// display, haptic feedback). Persisted locally; see `UserSettingsRepository`
/// for storage.
@immutable
class UserSettings {
  const UserSettings({
    this.localeOption = AppLocaleOption.system,
    this.themeOption = AppThemeOption.system,
    this.furiganaEnabled = true,
    this.hapticsEnabled = true,
  });

  /// Sensible defaults used before anything is stored: follow the device
  /// locale and appearance, show reading help, allow haptic feedback.
  static const UserSettings defaults = UserSettings();

  /// The learner's app-language choice.
  final AppLocaleOption localeOption;

  /// The learner's app-appearance (light/dark/system) choice.
  final AppThemeOption themeOption;

  /// Whether reading help (furigana) may render outside exam/active-recall
  /// contexts. Exam contexts always suppress it regardless of this flag.
  final bool furiganaEnabled;

  /// Whether subtle haptic feedback (selection ticks, confirmations) fires on
  /// interaction. When `false`, all app haptics are suppressed.
  final bool hapticsEnabled;

  UserSettings copyWith({
    AppLocaleOption? localeOption,
    AppThemeOption? themeOption,
    bool? furiganaEnabled,
    bool? hapticsEnabled,
  }) {
    return UserSettings(
      localeOption: localeOption ?? this.localeOption,
      themeOption: themeOption ?? this.themeOption,
      furiganaEnabled: furiganaEnabled ?? this.furiganaEnabled,
      hapticsEnabled: hapticsEnabled ?? this.hapticsEnabled,
    );
  }

  @override
  bool operator ==(Object other) =>
      other is UserSettings &&
      other.localeOption == localeOption &&
      other.themeOption == themeOption &&
      other.furiganaEnabled == furiganaEnabled &&
      other.hapticsEnabled == hapticsEnabled;

  @override
  int get hashCode =>
      Object.hash(localeOption, themeOption, furiganaEnabled, hapticsEnabled);
}
