/// Build-invariant application metadata.
///
/// Values that change per environment (API base URL, flavor name, Keycloak
/// realm, etc.) live in `AppEnvironment` (`core/config/app_environment.dart`).
/// The constants here are the same across all flavors. User-facing copy is
/// centralized here until the i18n layer (slang) lands in Phase 1.
abstract final class AppConfig {
  static const String appName = 'KotobaWorks';

  /// Short product tagline shown on the home placeholder.
  static const String tagline = 'Học tiếng Nhật BJT theo lộ trình';
}
