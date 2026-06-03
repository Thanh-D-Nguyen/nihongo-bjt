/// Per-environment runtime configuration.
///
/// Environment-specific values are injected at build time via `--dart-define`
/// so no staging/production URL is hard-coded in source. The default targets
/// the local API used in development (`pnpm dev:api`, port 4000); other
/// environments supply their own `API_BASE_URL`.
class AppEnvironment {
  const AppEnvironment({
    required this.apiBaseUrl,
    required this.keycloakIssuer,
    required this.oauthClientId,
    required this.oauthRedirectUri,
    required this.flashcardDataSource,
    this.googleSignInEnabled = true,
    this.googleIdpHint = _defaultGoogleIdpHint,
  });

  /// Builds the configuration from compile-time `--dart-define` values.
  factory AppEnvironment.fromDartDefine() {
    return const AppEnvironment(
      apiBaseUrl: String.fromEnvironment(
        'API_BASE_URL',
        defaultValue: _devApiBaseUrl,
      ),
      keycloakIssuer: String.fromEnvironment(
        'KEYCLOAK_ISSUER',
        defaultValue: _devKeycloakIssuer,
      ),
      oauthClientId: String.fromEnvironment(
        'OAUTH_CLIENT_ID',
        defaultValue: _defaultClientId,
      ),
      oauthRedirectUri: String.fromEnvironment(
        'OAUTH_REDIRECT_URI',
        defaultValue: _defaultRedirectUri,
      ),
      flashcardDataSource: String.fromEnvironment(
        'FLASHCARD_DATA_SOURCE',
        defaultValue: _defaultFlashcardDataSource,
      ),
      // Keeps all `--dart-define` keys discoverable in one place; the values
      // equal the constructor defaults only when the define is absent.
      // ignore: avoid_redundant_argument_values
      googleSignInEnabled: bool.fromEnvironment(
        'ENABLE_GOOGLE_SIGN_IN',
        defaultValue: true,
      ),
      // Same rationale as above: explicit define key over an implicit default.
      // ignore: avoid_redundant_argument_values
      googleIdpHint: String.fromEnvironment(
        'OAUTH_GOOGLE_IDP_HINT',
        defaultValue: _defaultGoogleIdpHint,
      ),
    );
  }

  /// Base URL of the KotobaWorks API, without a trailing slash.
  final String apiBaseUrl;

  /// OpenID Connect issuer for the Keycloak realm (without a trailing slash),
  /// e.g. `https://auth.example.com/realms/nihongo-bjt`. AppAuth discovers the
  /// authorization/token/end-session endpoints from `${issuer}/.well-known`.
  final String keycloakIssuer;

  /// Public OAuth client id for the mobile app (PKCE, no secret on device).
  final String oauthClientId;

  /// Custom-scheme redirect URI registered with the Keycloak client and the
  /// native platform manifests (Android `appAuthRedirectScheme`, iOS URL type).
  final String oauthRedirectUri;

  /// OIDC scopes requested during sign-in. `offline_access` yields a long-lived
  /// refresh token for session restore.
  static const List<String> oauthScopes = [
    'openid',
    'profile',
    'email',
    'offline_access',
  ];

  /// Whether AppAuth may use non-HTTPS endpoints. Only ever true for a local
  /// `http://` issuer (development); production issuers are HTTPS.
  bool get allowInsecureAuthConnections => keycloakIssuer.startsWith('http://');

  /// Selects the flashcard repository implementation: `mock` (default, for
  /// stable dev/test) or `api` (the real flashcard/SRS endpoints). Injected via
  /// `--dart-define=FLASHCARD_DATA_SOURCE=api`.
  final String flashcardDataSource;

  /// True when the flashcard feature should hit the real API.
  bool get useApiFlashcards => flashcardDataSource.toLowerCase() == 'api';

  /// Whether the "Continue with Google" button is surfaced on the auth screens.
  /// Disable via `--dart-define=ENABLE_GOOGLE_SIGN_IN=false` on environments
  /// whose Keycloak realm has no Google identity provider.
  final bool googleSignInEnabled;

  /// Keycloak identity-provider alias passed as `kc_idp_hint` for the federated
  /// Google flow. Must match the realm's Google IdP alias.
  final String googleIdpHint;

  /// Local development default (matches `pnpm dev:api`). Not a production URL.
  static const String _devApiBaseUrl = 'http://localhost:4000';

  /// Local development Keycloak realm issuer. Not a production URL.
  static const String _devKeycloakIssuer =
      'http://localhost:8080/realms/nihongo-bjt';

  /// Public client id provisioned in the Keycloak realm for mobile.
  static const String _defaultClientId = 'nihongo-mobile';

  /// Custom-scheme redirect; mirrors the native platform manifest entries.
  static const String _defaultRedirectUri =
      'com.nihongobjt.app://oauth2redirect';

  /// Default flashcard data source: the in-memory mock used for dev/test.
  static const String _defaultFlashcardDataSource = 'mock';

  /// Default Keycloak Google identity-provider alias (`kc_idp_hint=google`).
  static const String _defaultGoogleIdpHint = 'google';
}
