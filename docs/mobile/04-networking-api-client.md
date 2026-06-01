# 04 — Networking & API Client

> Talk to the NestJS backend over REST. Generate the client from `docs/openapi.json` so DTOs never drift.

---

## 1. Strategy: generate, don't hand-write

The backend already publishes an OpenAPI snapshot at `docs/openapi.json`. Generate a typed Dio client from it instead of writing DTOs by hand.

### Option A — openapi-generator (recommended)

```bash
# install once (brew / npm)
npm i -g @openapitools/openapi-generator-cli

# generate into an internal package
openapi-generator-cli generate \
  -i ../../docs/openapi.json \
  -g dart-dio \
  -o packages/api_client \
  --additional-properties=pubName=api_client,nullableFields=true,serializationLibrary=built_value
```

### Option B — swagger_parser (pure Dart, freezed output)

```yaml
# swagger_parser.yaml
swagger_parser:
  schema_path: ../../docs/openapi.json
  output_directory: packages/api_client/lib
  language: dart
  json_serializer: freezed
  client_postfix: Api
```

```bash
dart run swagger_parser
```

> Pick one and record it in repo memory. Option B keeps everything freezed/json_serializable consistent with the rest of the app; Option A is more battle-tested for large specs. Re-generate whenever `docs/openapi.json` changes (wire into CI as a drift check).

### Regeneration discipline

- Treat the generated client as build output: regenerate on spec change, review the diff.
- Add a CI job: regenerate and fail if `git diff` is non-empty (contract drift guard).

---

## 2. Dio configuration

```dart
// core/network/dio_provider.dart
@riverpod
Dio dio(Ref ref) {
  final env = ref.watch(envProvider);
  final dio = Dio(BaseOptions(
    baseUrl: env.apiBaseUrl,                 // http://localhost:4000 (dev)
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 20),
    headers: {'Accept': 'application/json'},
  ));
  dio.interceptors.addAll([
    AuthInterceptor(ref),
    RetryInterceptor(dio: dio),
    ErrorMappingInterceptor(),
    if (env.isDev) LoggingInterceptor(),
    SentryDioInterceptor(),
  ]);
  return dio;
}

@riverpod
DefaultApi apiClient(Ref ref) => DefaultApi(ref.watch(dioProvider));
```

---

## 3. Auth interceptor (token attach + refresh)

```dart
class AuthInterceptor extends QueuedInterceptor {
  AuthInterceptor(this.ref);
  final Ref ref;

  @override
  void onRequest(options, handler) async {
    final token = await ref.read(tokenStoreProvider).accessToken();
    if (token != null) options.headers['Authorization'] = 'Bearer $token';
    handler.next(options);
  }

  @override
  void onError(err, handler) async {
    if (err.response?.statusCode == 401 && !_isRefreshCall(err)) {
      final refreshed = await ref.read(authSessionProvider.notifier).refresh();
      if (refreshed) {
        final clone = await _retry(err.requestOptions);
        return handler.resolve(clone);
      }
      await ref.read(authSessionProvider.notifier).logout();
    }
    handler.next(err);
  }
}
```

- Use `QueuedInterceptor` so concurrent 401s trigger a **single** refresh, then replay queued requests.
- Never log tokens. Refresh logic lives in the auth session (doc 05).

---

## 4. Retry interceptor

Retry only **idempotent** + transient failures:

```dart
class RetryInterceptor extends Interceptor {
  static const _retryable = {502, 503, 504};
  @override
  void onError(err, handler) async {
    final retries = (err.requestOptions.extra['retries'] as int? ?? 0);
    final canRetry = _isIdempotent(err.requestOptions.method) &&
        (err.type == DioExceptionType.connectionTimeout ||
         _retryable.contains(err.response?.statusCode)) &&
        retries < 3;
    if (canRetry) {
      await Future.delayed(Duration(milliseconds: 300 * (retries + 1)));
      err.requestOptions.extra['retries'] = retries + 1;
      return handler.resolve(await Dio().fetch(err.requestOptions));
    }
    handler.next(err);
  }
}
```

> Do **not** auto-retry POST mutations that aren't idempotent — that's the sync queue's job (doc 06).

---

## 5. Error model & mapping

Backend error shape (from project standard): `{ statusCode, message, error }`.

```dart
// core/error/failure.dart
sealed class Failure {
  const Failure(this.message);
  final String message;
}
class NetworkFailure extends Failure { const NetworkFailure() : super('offline'); }
class ServerFailure extends Failure {
  const ServerFailure(super.message, this.statusCode);
  final int statusCode;
}
class AuthFailure extends Failure { const AuthFailure() : super('unauthorized'); }
class ValidationFailure extends Failure {
  const ValidationFailure(super.message, this.fields);
  final Map<String, String> fields;
}
```

```dart
class ErrorMappingInterceptor extends Interceptor {
  @override
  void onError(err, handler) {
    final code = err.response?.statusCode ?? 0;
    final body = err.response?.data;
    final failure = switch (code) {
      0   => const NetworkFailure(),
      401 => const AuthFailure(),
      422 => ValidationFailure(_msg(body), _fields(body)),
      >= 500 => ServerFailure(_msg(body), code),
      _   => ServerFailure(_msg(body), code),
    };
    handler.reject(DioException(
      requestOptions: err.requestOptions, error: failure, response: err.response));
  }
}
```

Repositories catch `DioException`, read `error as Failure`, and return a typed result. The UI maps `Failure` → i18n message (never shows raw server text).

```dart
String failureMessage(Failure f, Translations t) => switch (f) {
  NetworkFailure() => t.errors.offline,
  AuthFailure()    => t.errors.sessionExpired,
  ValidationFailure(:final fields) => fields.values.first,
  ServerFailure()  => t.errors.serverGeneric,
};
```

---

## 6. Repository pattern (offline-first read)

```dart
class FlashcardRepository {
  FlashcardRepository({required this.remote, required this.local, required this.connectivity});

  Stream<List<Deck>> watchDecks() async* {
    yield await local.getDecks();              // instant cache
    if (await connectivity.isOnline) {
      final fresh = await remote.fetchDecks();  // typed via generated client
      await local.upsertDecks(fresh);
      yield await local.getDecks();             // reconciled
    }
  }
}
```

Map generated DTOs → app/freezed models at the repository boundary so the rest of the app never depends on generated types directly. This isolates regeneration churn.

---

## 7. Cancellation

Pass a `CancelToken` from providers; cancel on dispose to avoid wasted work on fast navigation.

```dart
@riverpod
Future<List<SearchHit>> search(Ref ref, String q) async {
  final token = CancelToken();
  ref.onDispose(token.cancel);
  return ref.watch(searchRepositoryProvider).query(q, cancelToken: token);
}
```

---

## 8. Endpoints note

- All data access goes through backend REST. **Never** call Meilisearch/Postgres directly from the app.
- Base URLs come from flavor config (doc 08): dev `http://localhost:4000`, staging/prod from `--dart-define`.
- For Android emulator, `localhost` → `10.0.2.2`; handle in env config.

Next: [05 — Auth (Keycloak OIDC)](05-auth-keycloak.md)
