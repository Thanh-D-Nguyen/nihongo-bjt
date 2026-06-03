# Mobile E2E Validation Harness — API / Auth / Offline Queue

Phase 7. Manual end-to-end validation guide for running the Flutter app against a
**real** Keycloak + NihonGo BJT backend in **API mode**, and verifying the
Phase 6B manual offline-review sync.

> Status: **ready for manual validation**. This document is a harness/checklist.
> No E2E run has been executed against a real device/emulator yet, so nothing
> here is marked "passed". Record evidence in the results table at the bottom
> after a real run.

---

## 0. Prerequisites

- Backend API running and reachable (`pnpm dev:api`, port 4000 in dev).
- Keycloak realm `nihongo-bjt` running (dev: `http://localhost:8080`).
- Postgres/Redis/etc. up (see user infra notes — Docker runs in WSL).
- A seeded learner account in Keycloak that can authenticate.
- Flutter toolchain on PATH; device or emulator booted.

Mock mode stays the **default**. API mode is opt-in via `--dart-define` only.

---

## 1. Required `--dart-define` values

All environment-specific values are injected at build time — **never** hard-coded
or logged. Source defaults target local dev; override per environment.

| Define | Purpose | Dev example |
| --- | --- | --- |
| `API_BASE_URL` | API base, no trailing slash | `http://localhost:4000` via `adb reverse` (Android emu) |
| `KEYCLOAK_ISSUER` | OIDC issuer (realm), no trailing slash | `http://localhost:8080/realms/nihongo-bjt` via `adb reverse` |
| `OAUTH_CLIENT_ID` | Public mobile client id | `nihongo-mobile` |
| `OAUTH_REDIRECT_URI` | Custom-scheme redirect (matches native manifests) | `com.nihongobjt.app://oauth2redirect` |
| `FLASHCARD_DATA_SOURCE` | Selects repo: `mock` (default) or `api` | `api` |

### Run command (Android emulator → host backend)

```bash
adb reverse tcp:4000 tcp:4000
adb reverse tcp:8080 tcp:8080
```

```bash
flutter run \
  --dart-define=FLASHCARD_DATA_SOURCE=api \
  --dart-define=API_BASE_URL=http://localhost:4000 \
  --dart-define=KEYCLOAK_ISSUER=http://localhost:8080/realms/nihongo-bjt \
  --dart-define=OAUTH_CLIENT_ID=nihongo-mobile \
  --dart-define=OAUTH_REDIRECT_URI=com.nihongobjt.app://oauth2redirect
```

### Run command (iOS simulator → host backend)

iOS simulator shares the host network, so `localhost` works directly:

```bash
flutter run \
  --dart-define=FLASHCARD_DATA_SOURCE=api \
  --dart-define=API_BASE_URL=http://localhost:4000 \
  --dart-define=KEYCLOAK_ISSUER=http://localhost:8080/realms/nihongo-bjt \
  --dart-define=OAUTH_CLIENT_ID=nihongo-mobile \
  --dart-define=OAUTH_REDIRECT_URI=com.nihongobjt.app://oauth2redirect
```

> Tip: a real physical device must use the host machine's LAN IP (e.g.
> `http://192.168.x.x:4000`), not `localhost`/`10.0.2.2`, and the firewall must
> allow the ports.

---

## 2. Emulator / device localhost mapping

| Target | API/Keycloak host to use | Notes |
| --- | --- | --- |
| Android emulator (AVD) | `10.0.2.2` | Special alias to the host loopback. `localhost` on the emulator means the emulator itself. |
| Android Genymotion | `10.0.3.2` | Genymotion's host alias differs from AVD. |
| iOS simulator | `localhost` / `127.0.0.1` | Shares host network. |
| Physical device | Host LAN IP (e.g. `192.168.x.x`) | Device and host on the same network; open firewall ports. |

The app permits non-HTTPS endpoints **only** when the issuer is `http://`
(dev) — `AppEnvironment.allowInsecureAuthConnections`. Production issuers are
HTTPS, so cleartext is never silently allowed there.

---

## 3. Keycloak client config checklist

> **Provisioned (2026-06-02):** the `nihongo-mobile` client is now defined in
> `docker/keycloak/realm-export.json` (fresh import) and created idempotently by
> `docker/keycloak/configure-realms-http.sh` (`ensure_mobile_client`) for an
> already-persisted Keycloak DB. The boxes below are verification points, not
> outstanding setup.

Client `nihongo-mobile` in realm `nihongo-bjt`:

- [ ] **Public client** (Client authentication = OFF; no secret on device).
- [ ] **Standard flow** enabled (Authorization Code).
- [ ] **PKCE** required, method **S256** (Advanced → Proof Key for Code Exchange).
- [ ] **Valid redirect URIs** include `com.nihongobjt.app://oauth2redirect`
      (exact match with `OAUTH_REDIRECT_URI` and the native manifest entries).
- [ ] **Web origins** — set only if a web build is also used; not required for the
      native custom-scheme redirect. Use `+` to mirror redirect origins, or leave
      empty for native-only.
- [ ] Direct access grants / implicit flow **disabled** (not used; PKCE only).
- [ ] Scopes `openid profile email offline_access` available to the client
      (`offline_access` yields the refresh token used for session restore).
- [ ] Test learner account exists and can log in.

Native redirect registration must match the custom scheme:
- Android: `appAuthRedirectScheme` manifest placeholder = `com.nihongobjt.app`.
- iOS: a URL type with scheme `com.nihongobjt.app`.

---

## 4. Debug-only manual sync hook

Added (Phase 7): `DebugReviewSyncAction` —
`apps/mobile/lib/features/flashcards/presentation/debug_review_sync_action.dart`,
wired into the Flashcard deck-list `AppBar`.

- Renders **nothing** unless `kDebugMode == true` **and**
  `FLASHCARD_DATA_SOURCE=api` (mock mode has no queue). It is never present in a
  release/production build.
- One tap calls `flashcardReviewSyncServiceProvider.sync()` once (no timer/no
  polling) and shows a SnackBar with `synced / failed / total`.
- The counts message is produced by the pure, unit-tested
  `formatReviewSyncResult(...)`.

---

## 5. Manual E2E checklist

Run each step on the emulator/device with the API-mode command above.

### A. Auth (Keycloak PKCE)
- [ ] App launches; tapping sign-in opens the Keycloak login (AppAuth browser tab).
- [ ] After valid credentials, the app returns to the redirect and shows a
      signed-in session.
- [ ] Force-restart the app → session restores from the refresh token (no
      re-login), or expires gracefully.

### B. Flashcard API read
- [ ] Deck list loads from the real API (not the mock decks).
- [ ] Opening a deck loads its due review cards from the API.
- [ ] Kill the network, reopen a previously viewed deck → cached snapshot shows
      (Phase 6A read-through cache), no crash.

### C. Offline review queue + manual sync (Phase 6B/7)
- [ ] With network OFF (or signed-out → 401), grade several cards. The review
      flow is never blocked; grades that fail to submit are enqueued.
- [ ] Restore network / sign in. Tap the debug **sync** action in the deck-list
      AppBar.
- [ ] SnackBar reports the expected `synced / failed / total`.
- [ ] Tap sync again with an empty queue → "Hàng đợi trống".
- [ ] Verify on the backend that each graded review was recorded exactly once
      (no duplicates — local `idempotencyKey` dedup prevents double-enqueue;
      note server-side idempotency is **not** enforced yet, see §6).

---

## 6. Known limitation — idempotency

Server-side idempotency for flashcard reviews is **not enforced** (Phase 6B
finding). The idempotency key is stored locally to prevent double-**enqueue**,
but it is not sent on the wire. A retried sync of a row that actually reached the
server (but whose response was lost) could double-submit. Treat duplicate-detection
during E2E as a manual check until the backend honors `Idempotency-Key`.

---

## 7. Results log (fill in after a real run)

### Phase 7.1 attempt — 2026-06-01 (BLOCKED: infra not running)

A real manual E2E run was **attempted but could not proceed** — the required
infrastructure was not available on the dev machine at run time. Evidence
(commands actually executed):

| Check | Command | Result |
| --- | --- | --- |
| Emulator/device | `flutter devices` | only `windows`, `chrome`, `edge` — **no Android/iOS device** |
| Android AVD | `flutter emulators` | `Unable to find any emulator sources` — **no AVD images** |
| Backend API | `curl -m4 -o/dev/null -w%{http_code} http://localhost:4000/` | `000` (**not reachable**) |
| Keycloak | `curl -m4 ... http://localhost:9080/realms/nihongo-bjt/.well-known/openid-configuration` | `000` (**not reachable**) |

Blockers (all must be cleared before re-attempting):
1. No Android/iOS emulator or physical device connected (Keycloak PKCE login
   needs a native browser tab; Windows/web targets are out of scope for this
   custom-scheme redirect flow).
2. Backend API not running (`pnpm dev:api`, port 4000).
3. Keycloak realm not running (port 9080).

No step (login redirect → logout guard) could be exercised. **No "passed" claim
is made.** Re-run §5 once an emulator/device is connected and the API + Keycloak
are up; record per-step evidence in the table below.

| Date | Device/emulator | OS | Section | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| 2026-06-01 | none (infra down) | — | A/B/C | **BLOCKED** | commands above |

Do not mark this "passed" without a real device/emulator run and attached
evidence (logs/screenshots). No tokens may appear in any captured evidence.
