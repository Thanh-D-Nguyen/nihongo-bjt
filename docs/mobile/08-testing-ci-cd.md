# 08 — Testing, CI/CD & Roadmap

> Quality gates and a phased delivery plan. No feature ships without tests for its core logic.

---

## 1. Test pyramid

| Layer | Tool | Scope |
|-------|------|-------|
| Unit | `flutter_test` + `mocktail` | repositories, notifiers, use-cases (SRS, battle reducer, sync queue), error mapping |
| Widget | `flutter_test` | screens render loading/empty/error/data; interactions |
| Golden | `alchemist` / `golden_toolkit` | design-system components, Japanese text rendering (furigana) |
| Integration / E2E | `integration_test` + `patrol` | auth flow, offline→online sync, exam mode protection, battle happy path |

Coverage target: **core business logic ≥ 80%**. UI smoke for every screen. Mock at the repository boundary via Riverpod overrides.

### Example unit test

```dart
test('SRS computes next interval (Good)', () {
  final next = computeNextReview(card: c, grade: SrsGrade.good);
  expect(next.intervalDays, greaterThan(c.intervalDays));
});

test('offline review enqueues with idempotency key', () async {
  final repo = SrsRepositoryImpl(remote: failingRemote, local: fakeLocal, conn: offline);
  await repo.submitReview(cardId: 'x', grade: SrsGrade.good);
  expect(fakeLocal.queue.single.idempotencyKey, isNotEmpty);
});
```

### Critical behavioral tests (must exist)

- Exam mode hides meanings in `JapaneseText` (`examSafe`).
- 401 triggers single refresh, replays queued requests (interceptor + session dedup).
- Sync flush is idempotent (replaying same key doesn't double-apply).
- Logout wipes secure storage + cache + queue.

---

## 2. Flavors & environments

Three flavors: `dev`, `staging`, `prod`.

```dart
// core/config/env.dart
class EnvConfig {
  final String apiBaseUrl, keycloakBaseUrl;
  final bool isDev;
  factory EnvConfig.fromDefines() => EnvConfig._(
    apiBaseUrl: const String.fromEnvironment('API_BASE_URL',
        defaultValue: 'http://localhost:4000'),
    keycloakBaseUrl: const String.fromEnvironment('KC_BASE_URL',
        defaultValue: 'http://localhost:9080'),
    isDev: const bool.fromEnvironment('IS_DEV', defaultValue: true),
  );
}
```

```bash
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000 \
            --dart-define=KC_BASE_URL=http://10.0.2.2:9080 --dart-define=IS_DEV=true
flutter build apk --release \
  --dart-define=API_BASE_URL=https://api.nihongo-bjt.com \
  --dart-define=KC_BASE_URL=https://auth.nihongo-bjt.com --dart-define=IS_DEV=false
```

> Android emulator: `localhost` → `10.0.2.2`. iOS simulator can use `localhost`.

Entrypoints: `main_dev.dart`, `main_staging.dart`, `main_prod.dart` each call `bootstrap(env)`.

---

## 3. CI/CD pipeline (GitHub Actions)

```yaml
# .github/workflows/mobile.yml (sketch)
jobs:
  analyze-test:
    steps:
      - uses: subosito/flutter-action@v2
      - run: flutter pub get
        working-directory: apps/mobile
      - run: dart run build_runner build --delete-conflicting-outputs
      - run: dart format --set-exit-if-changed .
      - run: flutter analyze
      - run: flutter test --coverage
      - run: ./scripts/check_openapi_drift.sh   # regen client, fail if diff
  build:
    needs: analyze-test
    steps:
      - run: flutter build apk --flavor prod --release --dart-define=...
      - run: flutter build ipa --flavor prod --release --dart-define=...
```

- **Contract-drift guard**: regenerate API client from `docs/openapi.json`; fail if generated code differs from committed (or if codegen ignored, run on every build).
- **Signing/deploy**: Fastlane → TestFlight + Play internal track. Secrets in CI vault, never in repo.
- **Crash reporting**: Sentry release + source maps/symbols uploaded per build.

---

## 4. Observability

- `sentry_flutter` for crashes + performance traces (strip PII, never tokens).
- Structured logger (`logger` pkg) gated by flavor; no `print`.
- Analytics: emit real events to backend (matches "no fake analytics" rule); respect consent.

---

## 5. Definition of Done (per feature)

A mobile feature is done only when:

- [ ] Typed models (generated or freezed) + repository with offline-first read where applicable.
- [ ] Riverpod providers/notifiers; no logic in widgets.
- [ ] All async surfaces render loading (skeleton) / empty / error states.
- [ ] Server-authoritative writes; mutations queued + idempotent if offline-capable.
- [ ] i18n keys for all copy; no hardcoded strings.
- [ ] Entitlement/quota gating rendered from backend (no local paywall).
- [ ] Design tokens used; touch targets ≥ 48dp; press/hover/focus feedback.
- [ ] Unit tests for logic + widget smoke; critical behavioral tests where relevant.
- [ ] Verified on 375dp and tablet; floating elements never overlap.

---

## 6. Delivery roadmap (phased)

> Implement one phase at a time; only scaffold ahead to keep the app compiling.

### Phase 0 — Foundation
- `apps/mobile/` scaffold, flavors, `bootstrap` + `ProviderScope` + Sentry.
- Theme from `DESIGN.md`, font bundling, base `shared/widgets` kit.
- Dio + interceptors, error model, OpenAPI client generation.
- drift db + secure storage scaffolding.
- go_router skeleton + auth guard.

### Phase 1 — Auth
- Keycloak `nihongo-mobile` public client (PKCE) + AppAuth integration.
- Token store, session notifier (single-flight refresh), social login buttons.
- Login screen, session bootstrap, logout.

### Phase 2 — Core study (offline-capable)
- Flashcard decks list (offline-first), SRS review with sync queue + idempotency.
- Reading Assist layer (`JapaneseText`, furigana, assist sheet, add-to-deck).
- Home dashboard (bento grid), daily plan.

### Phase 3 — BJT practice + exam mode
- Question sets, exam mode (online-only, meaning suppression), scoring from backend.

### Phase 4 — Realtime battle
- Socket.IO wrapper, battle notifier (event reduction), connectivity guards.

### Phase 5 — Profile, monetization-aware UI, polish
- Settings (server-synced), entitlements display, upgrade UI (backend-gated).
- Golden tests, a11y pass, performance, store submission.

---

## 7. Open items to confirm with backend team

1. **Idempotency-Key** support on mutation endpoints (`/srs/review`, settings, progress).
2. **`nihongo-mobile`** public client + redirect URIs in Keycloak realm.
3. **App Links / Universal Links** domain + association files (for non-custom-scheme redirect).
4. OpenAPI snapshot kept current (CI publishes `docs/openapi.json` on backend change).
5. Entitlements endpoint (`/me/entitlements`) shape for client gating.

---

## 8. Next step

Choose scaffolding scope (from README decision):
- **(A)** Scaffold `apps/mobile/` Phase 0 + one sample feature.
- **(B)** This doc set first (done) → review, then scaffold.
- **(C)** API client generation + auth first.

Recommended: do **Phase 0 + Phase 1** as the first vertical slice (login working end-to-end), then iterate features.
