# 06 — Offline Sync & Storage

> Local DB is a **cache + outbound mutation queue**, never the source of truth for domain data.
> Backend (Postgres) is authoritative. This doc defines read caching, write queueing, and conflict policy.

---

## 1. What is and isn't allowed offline

| Capability | Offline behavior |
|------------|------------------|
| Browse cached decks / lessons / articles | ✅ read from drift cache |
| SRS review (grade cards) | ✅ optimistic + queued, server reconciles |
| Update settings / progress | ✅ queued |
| BJT **exam mode** (timed, scored) | ❌ online-only (integrity) |
| **Battle** (realtime) | ❌ online-only |
| Auth login / refresh | ❌ needs network (cached session allows app open) |
| Purchases / entitlement changes | ❌ backend-only |

> Anything affecting scoring integrity or money is online-only. Study/review is offline-capable.

---

## 2. drift schema (cache + queue)

```dart
// core/storage/app_database.dart
@DriftDatabase(tables: [Decks, Cards, ReviewLogs, SyncQueue, CacheMeta])
class AppDatabase extends _$AppDatabase {
  AppDatabase(super.e);
  @override int get schemaVersion => 1;
}
```

### Cache tables (mirror server projections)

```dart
class Decks extends Table {
  TextColumn get id => text()();
  TextColumn get title => text()();
  TextColumn get payload => text()();        // full JSON snapshot
  DateTimeColumn get updatedAt => dateTime()();
  @override Set<Column> get primaryKey => {id};
}
```

### Cache metadata (TTL / freshness)

```dart
class CacheMeta extends Table {
  TextColumn get key => text()();            // e.g. 'decks'
  DateTimeColumn get fetchedAt => dateTime()();
  @override Set<Column> get primaryKey => {key};
}
```

### Sync queue (outbound mutations)

```dart
class SyncQueue extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get endpoint => text()();        // POST /srs/review
  TextColumn get method => text()();
  TextColumn get body => text()();            // JSON
  TextColumn get idempotencyKey => text()();  // client-generated UUID
  IntColumn get attempts => integer().withDefault(const Constant(0))();
  DateTimeColumn get createdAt => dateTime()();
  TextColumn get status => text().withDefault(const Constant('pending'))();
}
```

---

## 3. Offline-first read (cache → network → reconcile)

```dart
Stream<List<Deck>> watchDecks() async* {
  yield await _local.getDecks();                 // 1. instant cache
  if (await _connectivity.isOnline && _stale('decks')) {
    final fresh = await _remote.fetchDecks();     // 2. network
    await _local.upsertDecks(fresh);              // 3. write cache
    await _local.touchMeta('decks');
    yield await _local.getDecks();                // 4. reconciled emit
  }
}

bool _stale(String key, {Duration ttl = const Duration(minutes: 15)}) { ... }
```

- Cache-first gives instant UI; network refreshes in background.
- TTL avoids hammering the API; force-refresh on pull-to-refresh by ignoring TTL.

---

## 4. Write path & sync queue

```dart
Future<void> submitReview({required String cardId, required SrsGrade grade}) async {
  final key = const Uuid().v4();
  // optimistic local apply
  await _local.applyReview(cardId, grade);

  if (await _connectivity.isOnline) {
    try {
      final res = await _remote.submitReview(cardId, grade, idempotencyKey: key);
      await _local.mergeServer(res);
      return;
    } catch (_) {/* fall through to queue */}
  }
  await _local.enqueue(SyncItem(
    endpoint: '/srs/review', method: 'POST',
    body: jsonEncode({'cardId': cardId, 'grade': grade.name}),
    idempotencyKey: key,
  ));
}
```

### Idempotency contract (backend coordination)

- Every queued mutation carries a client-generated `idempotencyKey` (UUID).
- Backend must treat repeated keys as the same operation (upsert / dedupe).
- This makes retries safe and prevents double-applied reviews.

> Action item: confirm backend endpoints accept an `Idempotency-Key` header (or body field) for `POST /srs/review` and similar mutations. If not present, add it server-side.

---

## 5. Sync service (flush on reconnect)

```dart
// core/storage/sync_service.dart
@Riverpod(keepAlive: true)
class SyncService extends _$SyncService {
  @override
  SyncStatus build() {
    ref.listen(connectivityProvider, (_, isOnline) {
      if (isOnline.valueOrNull == true) flush();
    });
    return SyncStatus.idle;
  }

  Future<void> flush() async {
    if (state == SyncStatus.syncing) return;
    state = SyncStatus.syncing;
    final db = ref.read(appDatabaseProvider);
    for (final item in await db.pendingQueue()) {
      try {
        await ref.read(apiClientProvider).send(item); // sends idempotency key
        await db.markDone(item.id);
      } on AuthFailure {
        state = SyncStatus.idle; return;              // wait for re-auth
      } catch (_) {
        await db.bumpAttempts(item.id);               // backoff, keep pending
        if (item.attempts >= 5) await db.markFailed(item.id);
      }
    }
    state = SyncStatus.idle;
  }
}
```

- Triggered on: app start, connectivity regained, after successful login, periodic (optional WorkManager/BGTaskScheduler for background flush).
- Ordered FIFO; failed items backoff and retry; permanently failing items surfaced to UI for manual retry.

---

## 6. Conflict policy

| Scenario | Policy |
|----------|--------|
| Local review vs server state | **Server wins on data, but no lost writes** — queued mutation is replayed; server applies it authoritatively and returns canonical state, which overwrites local cache. |
| Settings changed on two devices | **Last-write-wins** at server using `updatedAt`; client always re-pulls after push. |
| Cache stale vs fresh fetch | Fresh server snapshot replaces cache wholesale per key. |

Never silently drop a queued mutation. If the server rejects it (validation), surface a gentle error and mark the item failed for user action.

---

## 7. Cache invalidation

- TTL per cache key in `CacheMeta`.
- Explicit invalidation after writes (`touchMeta` reset) and on logout (`clear all`).
- On logout: wipe cache + queue + secure storage (no cross-account leakage).
- Schema migrations via drift `MigrationStrategy` with versioned steps.

---

## 8. Connectivity source

```dart
@Riverpod(keepAlive: true)
Stream<bool> connectivity(Ref ref) =>
    Connectivity().onConnectivityChanged.map((r) => r != ConnectivityResult.none);
```

Use as a gate for online-only features (exam/battle show a connectivity banner + disable start).

---

## 9. Storage rules (hard limits)

- ✅ Domain data cached in drift, truth on server.
- ✅ Tokens only in secure storage.
- ✅ Small UI prefs (theme override, furigana default) MAY use a `settings` table — but anything cross-device must also persist server-side.
- ❌ No business/persistent state in `SharedPreferences` or in-memory only.
- ❌ No queued mutation without idempotency key.

Next: [07 — Design system & UI](07-design-system-ui.md)
