/// Per-environment runtime configuration.
///
/// Environment-specific values are injected at build time via `--dart-define`
/// so no staging/production URL is hard-coded in source. The default targets
/// the local API used in development (`pnpm dev:api`, port 4000); other
/// environments supply their own `API_BASE_URL`.
class AppEnvironment {
  const AppEnvironment({
    required this.apiBaseUrl,
    required this.flashcardDataSource,
  });

  /// Builds the configuration from compile-time `--dart-define` values.
  factory AppEnvironment.fromDartDefine() {
    return const AppEnvironment(
      apiBaseUrl: String.fromEnvironment(
        'API_BASE_URL',
        defaultValue: _devApiBaseUrl,
      ),
      flashcardDataSource: String.fromEnvironment(
        'FLASHCARD_DATA_SOURCE',
        defaultValue: _defaultFlashcardDataSource,
      ),
    );
  }

  /// Base URL of the KotobaWorks API, without a trailing slash.
  final String apiBaseUrl;

  /// Selects the flashcard repository implementation: `mock` (default, for
  /// stable dev/test) or `api` (the real flashcard/SRS endpoints). Injected via
  /// `--dart-define=FLASHCARD_DATA_SOURCE=api`.
  final String flashcardDataSource;

  /// True when the flashcard feature should hit the real API.
  bool get useApiFlashcards => flashcardDataSource.toLowerCase() == 'api';

  /// Local development default (matches `pnpm dev:api`). Not a production URL.
  static const String _devApiBaseUrl = 'http://localhost:4000';

  /// Default flashcard data source: the in-memory mock used for dev/test.
  static const String _defaultFlashcardDataSource = 'mock';
}
