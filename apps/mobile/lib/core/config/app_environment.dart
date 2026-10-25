import 'package:flutter/foundation.dart';

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
    this.googleServerClientId = '',
    this.googleIosClientId = '',
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
      googleServerClientId: String.fromEnvironment('GOOGLE_SERVER_CLIENT_ID'),
      googleIosClientId: String.fromEnvironment('GOOGLE_IOS_CLIENT_ID'),
    );
  }

  /// Base URL of the KotobaWorks API, without a trailing slash.
  final String apiBaseUrl;

  /// Selects the flashcard repository implementation: `mock` (default, for
  /// stable dev/test) or `api` (the real flashcard/SRS endpoints). Injected via
  /// `--dart-define=FLASHCARD_DATA_SOURCE=api`.
  final String flashcardDataSource;

  /// Google OAuth **Web** client ID (`--dart-define=GOOGLE_SERVER_CLIENT_ID`).
  ///
  /// It must equal the server's `GOOGLE_OAUTH_CLIENT_ID`. The SDK requests ID
  /// tokens whose audience is this client, which the Go API verifies. It is a
  /// public identifier, not a secret. Empty disables Google sign-in.
  final String googleServerClientId;

  /// Google OAuth **iOS** client ID (`--dart-define=GOOGLE_IOS_CLIENT_ID`).
  /// Empty on other platforms. The matching reversed client ID must also be
  /// registered as a URL scheme in `ios/Runner/Info.plist`.
  final String googleIosClientId;

  /// True when the flashcard feature should hit the real API.
  bool get useApiFlashcards => flashcardDataSource.toLowerCase() == 'api';

  /// True when the required platform client IDs are supplied at build time.
  bool get googleSignInEnabled =>
      googleServerClientId.trim().isNotEmpty &&
      (defaultTargetPlatform != TargetPlatform.iOS ||
          googleIosClientId.trim().isNotEmpty);

  /// Local development default (matches `pnpm dev:api`). Not a production URL.
  static const String _devApiBaseUrl = 'http://localhost:4000';

  /// Default flashcard data source: the in-memory mock used for dev/test.
  static const String _defaultFlashcardDataSource = 'mock';
}
