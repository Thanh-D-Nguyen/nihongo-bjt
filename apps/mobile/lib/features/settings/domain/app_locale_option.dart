import 'dart:ui' show Locale;

/// The learner's app-language choice.
///
/// [system] defers to the device locale resolution (Vietnamese fallback);
/// [vietnamese] and [japanese] force that language regardless of the device.
enum AppLocaleOption {
  /// Follow the device locale (default).
  system,

  /// Force Vietnamese.
  vietnamese,

  /// Force Japanese.
  japanese;

  /// Stable storage token (kept independent of `name` so refactors never
  /// silently invalidate persisted values).
  String get storageValue => switch (this) {
    AppLocaleOption.system => 'system',
    AppLocaleOption.vietnamese => 'vi',
    AppLocaleOption.japanese => 'ja',
  };

  /// The forced [Locale], or `null` for [system] (let the app resolve it).
  Locale? get locale => switch (this) {
    AppLocaleOption.system => null,
    AppLocaleOption.vietnamese => const Locale('vi'),
    AppLocaleOption.japanese => const Locale('ja'),
  };

  /// Parses a stored [storageValue]; unknown/absent values fall back to
  /// [system] so a corrupt row never breaks startup.
  static AppLocaleOption fromStorage(String? value) => switch (value) {
    'vi' => AppLocaleOption.vietnamese,
    'ja' => AppLocaleOption.japanese,
    _ => AppLocaleOption.system,
  };
}
