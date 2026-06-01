# 05 — Auth (Keycloak OIDC, native PKCE)

> Reuse the existing Keycloak realm `nihongo-bjt`. Mobile uses a **public client + PKCE** native flow.
> Social login (Google/Facebook/Apple/LINE) works through Keycloak IdP brokering — same as web.

---

## 1. Keycloak client for mobile (new client required)

The web uses a **confidential** client (`nihongo-web`). Mobile cannot keep a secret on-device, so create a **public** client with PKCE.

| Setting | Value |
|---------|-------|
| Client ID | `nihongo-mobile` |
| Client type | **Public** |
| Standard flow | **On** (Authorization Code) |
| PKCE | **Required** (`S256`) |
| Valid redirect URIs | `com.nihongobjt.app://oauth2redirect/*` (custom scheme) and/or `https://app.nihongo-bjt.com/oauth2redirect` (App Links/Universal Links) |
| Web origins | n/a |
| Direct access grants | **Off** (no password grant) |

> Social IdPs are configured at the **realm** level and are already shared — no per-client work. Pass `kc_idp_hint=google` to skip the Keycloak UI and go straight to the provider, exactly like web.

---

## 2. Packages & platform setup

```yaml
dependencies:
  flutter_appauth: ^7.0.0
  flutter_secure_storage: ^9.0.0
```

**Android** (`android/app/build.gradle`):
```gradle
manifestPlaceholders += [appAuthRedirectScheme: 'com.nihongobjt.app']
```

**iOS** (`Info.plist`): register the URL scheme `com.nihongobjt.app`. For Universal Links, add the associated domain + `apple-app-site-association` on the backend.

---

## 3. OIDC service

```dart
// core/auth/keycloak_auth_service.dart
class KeycloakAuthService {
  KeycloakAuthService(this._appAuth, this._env);
  final FlutterAppAuth _appAuth;
  final EnvConfig _env;

  String get _issuer => '${_env.keycloakBaseUrl}/realms/nihongo-bjt';
  static const _clientId = 'nihongo-mobile';
  static const _redirect = 'com.nihongobjt.app://oauth2redirect';
  static const _scopes = ['openid', 'profile', 'email', 'offline_access'];

  Future<AuthTokens> login({String? idpHint}) async {
    final result = await _appAuth.authorizeAndExchangeCode(
      AuthorizationTokenRequest(
        _clientId, _redirect,
        issuer: _issuer,
        scopes: _scopes,
        promptValues: idpHint == null ? null : ['login'],
        additionalParameters: idpHint == null ? null : {'kc_idp_hint': idpHint},
      ),
    );
    return AuthTokens.fromAppAuth(result!);
  }

  Future<AuthTokens> refresh(String refreshToken) async {
    final result = await _appAuth.token(TokenRequest(
      _clientId, _redirect,
      issuer: _issuer,
      refreshToken: refreshToken,
      scopes: _scopes,
    ));
    return AuthTokens.fromAppAuth(result!);
  }

  Future<void> endSession(String idToken) async {
    await _appAuth.endSession(EndSessionRequest(
      idTokenHint: idToken,
      issuer: _issuer,
      postLogoutRedirectUrl: _redirect,
    ));
  }
}
```

`AuthorizationTokenRequest` performs PKCE (code challenge/verifier) automatically — never store a client secret.

---

## 4. Token storage (secure only)

```dart
// core/auth/token_store.dart
class TokenStore {
  final _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );

  Future<void> save(AuthTokens t) async {
    await _storage.write(key: 'access', value: t.accessToken);
    await _storage.write(key: 'refresh', value: t.refreshToken);
    await _storage.write(key: 'id', value: t.idToken);
    await _storage.write(key: 'exp', value: t.accessExpiry.toIso8601String());
  }
  Future<String?> accessToken() async { /* return if not near-expiry */ }
  Future<void> clear() => _storage.deleteAll();
}
```

- Access/refresh/id tokens go to **Keychain (iOS) / EncryptedSharedPreferences (Android)** — never SharedPreferences/plain files.
- Store access-token expiry to refresh proactively (refresh ~30s before expiry).

---

## 5. Session notifier (single refresh, app-wide auth state)

```dart
// core/auth/auth_session.dart
@Riverpod(keepAlive: true)
class AuthSession extends _$AuthSession {
  Completer<bool>? _refreshing;

  @override
  Future<AuthState> build() async {
    final store = ref.watch(tokenStoreProvider);
    final refresh = await store.refreshToken();
    if (refresh == null) return const AuthState.unauthenticated();
    return _hydrate(); // validate / lazy refresh
  }

  Future<void> login({String? idpHint}) async {
    final tokens = await ref.read(authServiceProvider).login(idpHint: idpHint);
    await ref.read(tokenStoreProvider).save(tokens);
    state = AsyncData(AuthState.authenticated(tokens.claims));
  }

  /// Deduplicated refresh — concurrent callers await the same future.
  Future<bool> refresh() {
    if (_refreshing != null) return _refreshing!.future;
    final c = _refreshing = Completer<bool>();
    () async {
      try {
        final store = ref.read(tokenStoreProvider);
        final rt = await store.refreshToken();
        if (rt == null) { c.complete(false); return; }
        final tokens = await ref.read(authServiceProvider).refresh(rt);
        await store.save(tokens);
        c.complete(true);
      } catch (_) {
        c.complete(false);
      } finally {
        _refreshing = null;
      }
    }();
    return c.future;
  }

  Future<void> logout() async {
    final id = await ref.read(tokenStoreProvider).idToken();
    if (id != null) await ref.read(authServiceProvider).endSession(id);
    await ref.read(tokenStoreProvider).clear();
    state = const AsyncData(AuthState.unauthenticated());
  }
}
```

The dedup logic pairs with the `QueuedInterceptor` (doc 04): many 401s → one refresh → replay.

---

## 6. Route guards (go_router)

```dart
// core/router/router.dart
@riverpod
GoRouter router(Ref ref) {
  final auth = ref.watch(authSessionProvider);
  return GoRouter(
    refreshListenable: GoRouterRefreshNotifier(ref, authSessionProvider),
    redirect: (context, state) {
      final authed = auth.valueOrNull is Authenticated;
      final loggingIn = state.matchedLocation == '/login';
      if (!authed && !loggingIn) return '/login';
      if (authed && loggingIn) return '/';
      return null;
    },
    routes: [ /* feature routes */ ],
  );
}
```

---

## 7. Social login UI

Buttons just pass the IdP hint; Keycloak handles brokering:

```dart
SocialButton.google(onTap: () =>
    ref.read(authSessionProvider.notifier).login(idpHint: 'google'));
SocialButton.line(onTap: () =>
    ref.read(authSessionProvider.notifier).login(idpHint: 'line'));
```

The native browser tab (ASWebAuthenticationSession / Custom Tabs) opens, user authenticates with the provider, returns via redirect. No Keycloak UI shown.

---

## 8. Security checklist

- ✅ Public client + PKCE `S256`, no secret on device.
- ✅ Tokens in Keychain/EncryptedSharedPreferences only.
- ✅ Use system browser (AppAuth uses ASWebAuthenticationSession / Chrome Custom Tabs) — **not** an embedded WebView (prevents credential phishing, satisfies IdP policies).
- ✅ Proactive + reactive refresh, single-flight.
- ✅ `offline_access` scope for long-lived refresh token; rotate per Keycloak policy.
- ✅ Logout clears secure storage + ends Keycloak session.
- ✅ Validate `iss`, `aud`, `exp` on ID token; pin issuer to the realm URL.
- ❌ Never log tokens or put them in URLs/analytics.

Next: [06 — Offline sync & storage](06-offline-sync-storage.md)
