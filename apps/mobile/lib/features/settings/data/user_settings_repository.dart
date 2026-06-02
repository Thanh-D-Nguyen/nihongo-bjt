import 'package:nihongo_bjt/features/settings/data/local/user_settings_dao.dart';
import 'package:nihongo_bjt/features/settings/domain/app_locale_option.dart';
import 'package:nihongo_bjt/features/settings/domain/user_settings.dart';

/// Persists and reads [UserSettings] over the device-scoped key/value DAO.
///
/// Owns the storage keys and the encoding of each preference. Defaults are
/// applied for absent/corrupt values so the app always loads.
class UserSettingsRepository {
  UserSettingsRepository(this._dao);

  final UserSettingsDao _dao;

  static const String _localeKey = 'locale_override';
  static const String _furiganaKey = 'furigana_enabled';

  /// Loads the stored settings, falling back to [UserSettings.defaults].
  Future<UserSettings> load() async {
    final all = await _dao.readAll();
    return UserSettings(
      localeOption: AppLocaleOption.fromStorage(all[_localeKey]),
      furiganaEnabled: _decodeBool(all[_furiganaKey], fallback: true),
    );
  }

  /// Persists the app-language choice.
  Future<void> saveLocaleOption(AppLocaleOption option) =>
      _dao.write(_localeKey, option.storageValue);

  /// Persists the furigana display preference.
  Future<void> saveFuriganaEnabled({required bool enabled}) =>
      _dao.write(_furiganaKey, enabled ? 'true' : 'false');

  static bool _decodeBool(String? value, {required bool fallback}) =>
      switch (value) {
        'true' => true,
        'false' => false,
        _ => fallback,
      };
}
