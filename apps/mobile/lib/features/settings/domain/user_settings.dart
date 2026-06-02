import 'package:meta/meta.dart';
import 'package:nihongo_bjt/features/settings/domain/app_locale_option.dart';

/// Immutable snapshot of the learner's device-scoped preferences.
///
/// Presentation preferences only (app language, furigana display). Persisted
/// locally; see `UserSettingsRepository` for storage.
@immutable
class UserSettings {
  const UserSettings({
    this.localeOption = AppLocaleOption.system,
    this.furiganaEnabled = true,
  });

  /// Sensible defaults used before anything is stored: follow the device
  /// locale, show reading help.
  static const UserSettings defaults = UserSettings();

  /// The learner's app-language choice.
  final AppLocaleOption localeOption;

  /// Whether reading help (furigana) may render outside exam/active-recall
  /// contexts. Exam contexts always suppress it regardless of this flag.
  final bool furiganaEnabled;

  UserSettings copyWith({
    AppLocaleOption? localeOption,
    bool? furiganaEnabled,
  }) {
    return UserSettings(
      localeOption: localeOption ?? this.localeOption,
      furiganaEnabled: furiganaEnabled ?? this.furiganaEnabled,
    );
  }

  @override
  bool operator ==(Object other) =>
      other is UserSettings &&
      other.localeOption == localeOption &&
      other.furiganaEnabled == furiganaEnabled;

  @override
  int get hashCode => Object.hash(localeOption, furiganaEnabled);
}
