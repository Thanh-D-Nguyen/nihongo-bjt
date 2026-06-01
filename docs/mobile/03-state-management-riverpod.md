# 03 — State Management (Riverpod 2.x, codegen)

> One library for state + DI. Use code generation (`@riverpod`) everywhere for type safety and less boilerplate.

---

## 1. Why Riverpod (recap)

- Compile-safe dependency graph, no `BuildContext` needed to read state.
- Built-in DI (providers replace get_it).
- `autoDispose` by default with codegen → no leaks.
- First-class async (`AsyncValue`) with loading/error/data baked in.
- Easy testing via `ProviderContainer` + overrides.

---

## 2. Provider taxonomy (which to use)

| Need | Use | Codegen form |
|------|-----|--------------|
| Inject a dependency (repo, service) | provider returning the object | `@riverpod Dio dio(Ref ref) => ...` |
| Derive/read async data | function provider returning `Future<T>` | `@riverpod Future<List<Deck>> deckList(Ref ref)` |
| Mutable state + methods | `Notifier` / `AsyncNotifier` class | `@riverpod class ReviewNotifier extends _$ReviewNotifier` |
| Synchronous derived value | function provider returning `T` | `@riverpod bool isExamMode(Ref ref)` |
| Stream (realtime) | function provider returning `Stream<T>` | `@riverpod Stream<BattleEvent> battleEvents(Ref ref)` |

> Prefer `AsyncNotifier` for anything that loads + mutates. Prefer plain function providers for pure reads/derivations.

---

## 3. Dependency injection layer

```dart
// core/network/dio_provider.dart
@riverpod
Dio dio(Ref ref) {
  final auth = ref.watch(authSessionProvider.notifier);
  final dio = Dio(BaseOptions(baseUrl: ref.watch(envProvider).apiBaseUrl));
  dio.interceptors.addAll([
    AuthInterceptor(auth),       // attaches + refreshes token
    RetryInterceptor(),
    LoggingInterceptor(),
  ]);
  return dio;
}

// feature repository wired via DI
@riverpod
FlashcardRepository flashcardRepository(Ref ref) => FlashcardRepository(
      remote: FlashcardRemoteDs(ref.watch(apiClientProvider)),
      local: FlashcardLocalDs(ref.watch(appDatabaseProvider)),
      connectivity: ref.watch(connectivityProvider),
    );
```

Repositories/services are **always** provided, never `new`-ed inside widgets. This makes them overridable in tests.

---

## 4. Async read pattern (offline-first list)

```dart
// presentation/providers/deck_list_provider.dart
@riverpod
Future<List<Deck>> deckList(Ref ref) async {
  final repo = ref.watch(flashcardRepositoryProvider);
  return repo.getDecks(); // repo emits cache then refreshes; see data layer
}
```

```dart
// screen
class DeckListScreen extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final decks = ref.watch(deckListProvider);
    return decks.when(
      loading: () => const DeckListSkeleton(),     // shimmer, matches content
      error: (e, _) => ErrorRetry(onRetry: () => ref.invalidate(deckListProvider)),
      data: (list) => list.isEmpty
          ? const DecksEmptyState()                 // encouraging + CTA
          : DeckGrid(decks: list),
    );
  }
}
```

> Every async surface renders **all three** states (loading skeleton / error retry / empty state). This is mandatory per UI standards.

---

## 5. Mutation pattern (AsyncNotifier)

```dart
// presentation/providers/review_notifier.dart
@riverpod
class ReviewNotifier extends _$ReviewNotifier {
  @override
  Future<ReviewSession> build(String deckId) {
    return ref.watch(srsRepositoryProvider).startSession(deckId);
  }

  Future<void> grade(String cardId, SrsGrade grade) async {
    final repo = ref.read(srsRepositoryProvider);
    // optimistic update
    state = AsyncData(state.requireValue.applyLocalGrade(cardId, grade));
    try {
      final updated = await repo.submitReview(cardId: cardId, grade: grade);
      state = AsyncData(state.requireValue.merge(updated));
    } catch (e, st) {
      // queued offline OR real failure — repo decides; surface error if needed
      state = AsyncError(e, st);
    }
  }
}
```

Key rules:
- Mutations live in the Notifier, never in the widget.
- Optimistic updates are allowed but must reconcile with the server response (server-authoritative).
- Errors propagate as `AsyncError` and map to gentle UI (retry, not raw exception text).

---

## 6. Cross-provider dependencies

```dart
@riverpod
bool canUsePremiumDecks(Ref ref) {
  final entitlements = ref.watch(entitlementsProvider).valueOrNull;
  return entitlements?.has('premium_decks') ?? false;
}
```

- `ref.watch` to react to changes; `ref.read` for one-off actions inside methods.
- Entitlement/quota state comes from backend (`entitlementsProvider` fetches `/me/entitlements`). UI gates render from this — **no local paywall logic**.

---

## 7. Lifecycle & caching

- Codegen providers are `autoDispose` by default → disposed when no listener.
- Keep alive intentionally when needed:

```dart
@Riverpod(keepAlive: true)
Future<UserProfile> userProfile(Ref ref) => ...; // session-long
```

- Use `ref.keepAlive()` + a timer for time-bounded caches.
- Invalidate explicitly after writes: `ref.invalidate(deckListProvider)`.

---

## 8. Realtime (battle) with Riverpod

```dart
@riverpod
Stream<BattleEvent> battleEvents(Ref ref, String roomId) {
  final socket = ref.watch(battleSocketProvider(roomId));
  ref.onDispose(socket.dispose);
  return socket.events;
}

@riverpod
class BattleNotifier extends _$BattleNotifier {
  @override
  BattleState build(String roomId) {
    ref.listen(battleEventsProvider(roomId), (_, next) {
      next.whenData((e) => state = _reduce(state, e));
    });
    return BattleState.initial();
  }
  void submitAnswer(String choice) =>
      ref.read(battleSocketProvider(roomId)).emit('answer', choice);
}
```

Event-driven reduction gives BLoC-like clarity for the one feature that benefits from it — without adding a second state library.

---

## 9. Testing providers

```dart
test('deckList returns cached then remote', () async {
  final container = ProviderContainer(overrides: [
    flashcardRepositoryProvider.overrideWithValue(FakeFlashcardRepo()),
  ]);
  addTearDown(container.dispose);

  final decks = await container.read(deckListProvider.future);
  expect(decks, isNotEmpty);
});
```

Override providers at the boundary (repository), not deep internals.

---

## 10. Anti-patterns (reject in review)

- ❌ Business logic inside `build()` of a widget.
- ❌ `ref.read` inside `build` for reactive data (use `ref.watch`).
- ❌ Mutating state outside a Notifier.
- ❌ Manually managing `StreamController` when an `AsyncNotifier`/stream provider fits.
- ❌ `keepAlive: true` everywhere (defeats auto-dispose; only for session-scoped data).
- ❌ Passing `WidgetRef` down into non-widget classes.

Next: [04 — Networking & API client](04-networking-api-client.md)
