import 'dart:ui' show Locale;

import 'package:flutter/material.dart' show ThemeMode;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nihongo_bjt/core/database/database_provider.dart';
import 'package:nihongo_bjt/features/auth/presentation/auth_controller.dart';
import 'package:nihongo_bjt/features/settings/data/user_settings_repository.dart';
import 'package:nihongo_bjt/features/settings/domain/app_locale_option.dart';
import 'package:nihongo_bjt/features/settings/domain/app_theme_option.dart';
import 'package:nihongo_bjt/features/settings/domain/id_token_claims.dart';
import 'package:nihongo_bjt/features/settings/domain/user_settings.dart';

/// Repository over the device-scoped settings DAO.
final userSettingsRepositoryProvider = Provider<UserSettingsRepository>((ref) {
  return UserSettingsRepository(ref.watch(userSettingsDaoProvider));
});

/// Owns the learner's device-scoped preferences: loads them on first read,
/// then exposes mutations that persist and update state optimistically.
///
/// Kept alive for the app lifetime (the root [Locale] and reading-help policy
/// depend on it continuously).
final settingsControllerProvider =
    AsyncNotifierProvider<SettingsController, UserSettings>(
      SettingsController.new,
    );

class SettingsController extends AsyncNotifier<UserSettings> {
  UserSettingsRepository get _repository =>
      ref.read(userSettingsRepositoryProvider);

  @override
  Future<UserSettings> build() => _repository.load();

  /// Sets the app-language choice and persists it. State updates immediately;
  /// a write failure reverts the optimistic value and rethrows so the caller
  /// can surface it.
  Future<void> setLocaleOption(AppLocaleOption option) async {
    await _update(
      (current) => current.copyWith(localeOption: option),
      persist: () => _repository.saveLocaleOption(option),
    );
  }

  /// Sets the app-appearance (light/dark/system) choice and persists it.
  Future<void> setThemeOption(AppThemeOption option) async {
    await _update(
      (current) => current.copyWith(themeOption: option),
      persist: () => _repository.saveThemeOption(option),
    );
  }

  /// Toggles furigana display and persists it.
  Future<void> setFuriganaEnabled({required bool enabled}) async {
    await _update(
      (current) => current.copyWith(furiganaEnabled: enabled),
      persist: () => _repository.saveFuriganaEnabled(enabled: enabled),
    );
  }

  /// Toggles haptic feedback and persists it.
  Future<void> setHapticsEnabled({required bool enabled}) async {
    await _update(
      (current) => current.copyWith(hapticsEnabled: enabled),
      persist: () => _repository.saveHapticsEnabled(enabled: enabled),
    );
  }

  Future<void> _update(
    UserSettings Function(UserSettings current) change, {
    required Future<void> Function() persist,
  }) async {
    final current = state.value ?? UserSettings.defaults;
    final next = change(current);
    state = AsyncData(next);
    try {
      await persist();
    } on Object {
      // Revert to the last known-good value and let the caller surface it.
      state = AsyncData(current);
      rethrow;
    }
  }
}

/// The effective root [Locale], or `null` to defer to device resolution.
///
/// Reads the persisted [AppLocaleOption]; before settings load (or on error)
/// it returns `null` so the app uses its device-locale fallback.
final localeOverrideProvider = Provider<Locale?>((ref) {
  final settings = ref.watch(settingsControllerProvider).value;
  return settings?.localeOption.locale;
});

/// The effective app [ThemeMode]. Reads the persisted [AppThemeOption];
/// before settings load (or on error) it defers to [ThemeMode.system].
final themeModeProvider = Provider<ThemeMode>((ref) {
  final settings = ref.watch(settingsControllerProvider).value;
  return settings?.themeOption.themeMode ?? ThemeMode.system;
});

/// Whether the learner wants reading help (furigana) shown outside exam
/// contexts. Defaults to `true` until settings load.
final furiganaEnabledProvider = Provider<bool>((ref) {
  final settings = ref.watch(settingsControllerProvider).value;
  return settings?.furiganaEnabled ?? true;
});

/// Whether the learner wants haptic feedback. Defaults to `true` until
/// settings load. The root widget mirrors this into `AppHaptics.enabled`.
final hapticsEnabledProvider = Provider<bool>((ref) {
  final settings = ref.watch(settingsControllerProvider).value;
  return settings?.hapticsEnabled ?? true;
});

/// Display identity decoded from the current session's ID token, or
/// [IdTokenClaims.empty] when there is no authenticated session.
final profileClaimsProvider = Provider<IdTokenClaims>((ref) {
  final session = ref.watch(authControllerProvider).value;
  return IdTokenClaims.fromIdToken(session?.tokens?.idToken);
});
