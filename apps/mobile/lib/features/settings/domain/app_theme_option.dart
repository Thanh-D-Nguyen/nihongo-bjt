import 'package:flutter/material.dart' show ThemeMode;

/// The learner's app-appearance choice.
///
/// [system] follows the device light/dark setting (default); [light] and
/// [dark] force that brightness regardless of the device.
enum AppThemeOption {
  /// Follow the device light/dark setting (default).
  system,

  /// Force the light theme.
  light,

  /// Force the dark theme.
  dark;

  /// Stable storage token (kept independent of `name` so refactors never
  /// silently invalidate persisted values).
  String get storageValue => switch (this) {
    AppThemeOption.system => 'system',
    AppThemeOption.light => 'light',
    AppThemeOption.dark => 'dark',
  };

  /// The Flutter [ThemeMode] this option maps to.
  ThemeMode get themeMode => switch (this) {
    AppThemeOption.system => ThemeMode.system,
    AppThemeOption.light => ThemeMode.light,
    AppThemeOption.dark => ThemeMode.dark,
  };

  /// Parses a stored [storageValue]; unknown/absent values fall back to
  /// [system] so a corrupt row never breaks startup.
  static AppThemeOption fromStorage(String? value) => switch (value) {
    'light' => AppThemeOption.light,
    'dark' => AppThemeOption.dark,
    _ => AppThemeOption.system,
  };
}
