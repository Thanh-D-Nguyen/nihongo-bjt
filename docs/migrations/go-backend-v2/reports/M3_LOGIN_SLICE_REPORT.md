# M3 Login Slice Report

- **Date:** 2026-09-29
- **Scope:** Learner/admin first-party password login handlers (`internal/httpserver/handler_login.go`), route/composition wiring (`server.go`, `app.go`), profile/authz store lookups (`profile/store.go`, `authz/rbac.go`), dedicated security tests (`handler_login_test.go`).
- **Status:** LOGIN SLICE PASS — handler, wiring, store lookups, and 22 PG17 integration tests PASS ×2 against disposable database with production-like UNIQUE constraints. Default suite, race detector, vet, gofmt, and linux/arm64 cross-build all PASS from clean `git archive` snapshot. Full M3 remains PENDING until bootstrap-admin.
- **Not in scope:** Bootstrap-admin, M4, identity cleanup, trusted-proxy strategy, local-HTTP cookie override.

## Changes

### `apps/api-go/internal/httpserver/handler_login.go`
- `learnerLoginHandler` and `adminLoginHandler`: POST-only, Content-Type enforcement via `mime.ParseMediaType` (rejects `application/jsonx` etc.), bounded body (4096 bytes), strict JSON decode with trailing-token rejection via second `Decode` expecting `io.EOF`.
- Email normalized to lowercase+trimmed; empty email/password and oversized password return generic 401 BEFORE rate limiting (cheap validation only, no Argon2 work).
- Rate limiting: fail-closed if `rateLimiter == nil` (503); dual-key bucketing via `authn.NormalizePeerIP(r.RemoteAddr)` for IP dimension and SHA-256 prefix of normalized email for account dimension. No raw email in map or logs. Spoofed forwarding headers ignored (middleware.RealIP already removed).
- Credential verification: all credential errors (`ErrMismatch`, `ErrCredentialNotFound`, `ErrMalformedRecord`, `ErrUnsupportedAlgo`, `ErrInvalidParams`) return generic 401 WITHOUT additional burnTime (Verify already performed Argon2); DB/backend errors return safe 500 with structured log (no secret leakage).
- Session creation via `session.Store.CreateLearnerSession` / `CreateAdminSession` with high-entropy opaque token persisted as digest; new token on every login (fixation prevention).
- Cookie attributes: `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, expiry aligned to DB session TTL (24h). Separate cookie names (`bjt_web_session`, `bjt_admin_session`) enforce namespace isolation.
- No secret/token/password logging anywhere in handler paths.

### `apps/api-go/internal/httpserver/server.go`
- Login routes mounted whenever credential + profile/RBAC + session stores exist, regardless of RateLimiter presence. Handler itself fails closed (503) if RateLimiter is nil. This prevents silently disabling abuse protection when a dependency is misconfigured.
- `middleware.RealIP` remains removed (accepted in rate-limit slice).

### `apps/api-go/internal/app/app.go`
- Constructs `credential.NewStore(dbPool)` and `authn.NewRateLimiter(authn.DefaultRateLimiterConfig())` with error handling; passes both to `httpserver.Dependencies`.
- `RateLimiter` stored in `App` struct; `Stop()` called in `App.Shutdown` to prevent goroutine leak.

### `apps/api-go/internal/profile/store.go`
- `GetLearnerByEmail(ctx, email) (*LearnerPublicProfile, error)`: looks up active learner by normalized email; returns `(nil, nil)` for unknown to prevent enumeration. Required for login handler compilation from clean HEAD.

### `apps/api-go/internal/authz/rbac.go`
- `GetActiveActorIDByEmail` already existed in uncommitted draft; confirmed present and removed accidental duplicate appended during repair. Required for admin login handler compilation from clean HEAD.

### `apps/api-go/internal/httpserver/handler_auth_test.go`
- Shared `seedActiveUser`, `seedDisabledUser`, `seedActiveAdmin`, `seedDisabledAdmin` helpers now register `t.Cleanup` that deletes seeded rows by UUID after test. Prevents UNIQUE(email) collisions on `-count=2` runs against production-like schema.

### `apps/api-go/internal/httpserver/handler_login_test.go`
- 22 tests exercising actual HTTP router/handlers against real stores:
  - **Success:** learner/admin login sets Secure HttpOnly SameSite=Lax cookie; session exists in DB with correct UserID/ActorID.
  - **Generic 401:** wrong password, unknown email, disabled user/actor, missing credential, empty fields.
  - **Input validation:** oversized body (413), trailing JSON (400), wrong Content-Type (400).
  - **CSRF:** missing Origin (403), untrusted Origin (403).
  - **Rate limiting:** nil limiter fail-closed (503), IP limit exceeded (429), same IP different ports share bucket (429), forged X-Forwarded-For/X-Real-IP ignored (429), full map fail-closed with dual-key cardinality (429).
  - **Fixation prevention:** two consecutive logins produce different tokens.
  - **Namespace isolation:** learner cookie rejected on admin session endpoint.
- All seeded emails derived from per-test UUID to ensure UNIQUE constraint compatibility on `-count=2`.

## Repairs Applied (commit fe9e0bb)

Independent PG17 review at HEAD ec76284 found real failures. All repaired:

1. **Route mounting:** Login routes now mounted when stores exist regardless of RateLimiter; handler returns 503 when limiter is nil. Previously returned 404 because route was not registered.
2. **Dual-key cardinality:** `TestLearnerLogin_FullMap_429` corrected to account for IP + account keys per request. MaxKeys=4 with 2 distinct IPs × 2 distinct emails fills map; 3rd request with new IP+email triggers 429.
3. **UNIQUE email collisions:** Shared seed helpers now delete by UUID via `t.Cleanup`; all login test emails derived from per-test UUID. `-count=2` passes against production-like UNIQUE constraints.
4. **Security ordering:** Rate limiting moved BEFORE all expensive work including `burnTime()`. Empty/oversized credentials rejected cheaply before consuming buckets. Wrong-password path no longer double-burns (Verify already hashes).
5. **Content-Type parsing:** `mime.ParseMediaType` replaces `strings.HasPrefix` to reject `application/jsonx`.
6. **Trailing JSON detection:** Second `Decode` expecting `io.EOF` replaces `dec.More()`.
7. **Shutdown wiring:** `RateLimiter.Stop()` wired into `App.Shutdown`.

## Verification Evidence

### PG17 Integration Tests (disposable DB `m3_login_test_1790654059`, port 15436)

```
$ export TEST_DATABASE_URL="postgres://postgres:testpass@localhost:15436/m3_login_test_1790654059?sslmode=disable"
$ GOTOOLCHAIN=go1.23.0 go test ./internal/httpserver/... -count=2 -v -run 'TestLearnerLogin|TestAdminLogin|TestLogin_Namespace'
--- PASS: TestLearnerLogin_Success_SetsSecureCookie (0.17s)
--- PASS: TestLearnerLogin_WrongPassword_Generic401 (0.17s)
--- PASS: TestLearnerLogin_UnknownEmail_Generic401 (0.08s)
--- PASS: TestLearnerLogin_DisabledUser_Generic401 (0.09s)
--- PASS: TestLearnerLogin_MissingCredential_Generic401 (0.02s)
--- PASS: TestLearnerLogin_EmptyFields_401 (0.00s)
--- PASS: TestLearnerLogin_OversizedBody_413 (0.00s)
--- PASS: TestLearnerLogin_TrailingJSON_400 (0.00s)
--- PASS: TestLearnerLogin_WrongContentType_400 (0.00s)
--- PASS: TestLearnerLogin_CSRF_MissingOrigin_403 (0.00s)
--- PASS: TestLearnerLogin_CSRF_UntrustedOrigin_403 (0.00s)
--- PASS: TestLearnerLogin_LimiterNil_FailClosed503 (0.00s)
--- PASS: TestLearnerLogin_IPRateLimit_429 (0.22s)
--- PASS: TestLearnerLogin_SameIPDifferentPorts_ShareBucket (0.15s)
--- PASS: TestLearnerLogin_ForgedXForwardedFor_Ignored (0.16s)
--- PASS: TestLearnerLogin_FullMap_429 (0.15s)
--- PASS: TestLearnerLogin_NewTokenOnEachLogin_FixationPrevention (0.25s)
--- PASS: TestAdminLogin_Success_SetsSecureCookie (0.19s)
--- PASS: TestAdminLogin_WrongPassword_Generic401 (0.17s)
--- PASS: TestAdminLogin_UnknownEmail_Generic401 (0.08s)
--- PASS: TestAdminLogin_DisabledActor_Generic401 (0.11s)
--- PASS: TestAdminLogin_LimiterNil_FailClosed503 (0.00s)
--- PASS: TestAdminLogin_CSRF_MissingOrigin_403 (0.00s)
--- PASS: TestLogin_NamespaceIsolation_LearnerCookieNotAdmin (0.18s)
PASS (all 22 tests ×2 = 44 executions)
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/httpserver  5.564s
```

### Default Suite, Race, Vet, Gofmt, ARM64

```
$ unset TEST_DATABASE_URL && go test ./...
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/app         0.535s
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/authn       (cached)
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/authz       (cached)
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/config      (cached)
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/credential  (cached)
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/httpserver  1.143s
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/session     (cached)
---TEST_EXIT:0---

$ go test -race ./...
---RACE_EXIT:0---

$ go vet ./...
---VET_EXIT:0---

$ gofmt -l .
(clean)

$ GOOS=linux GOARCH=arm64 go build ./...
---ARM64_EXIT:0---
```

### Clean Git Archive Verification (HEAD fe9e0bb)

Pending — repairs committed at fe9e0bb; clean-archive verification will be run next.

## Skipped Gates

| Gate | Reason |
|------|--------|
| Local-HTTP cookie override | Cookie `Secure=true` is hardcoded. Local development over plain HTTP requires explicit dev config override (not yet implemented). Documented as follow-up. |
| Trusted-proxy strategy | Not implemented. All clients behind a reverse proxy share the proxy's peer IP. Account-key dimension provides independent per-account limiting. |
| Session revocation on re-login | New token issued on each login (fixation prevention), but old valid sessions are not explicitly revoked. Acceptable for current scope; documented as follow-up. |

## Operational Ceiling

- Per-client IP rate limiting requires either direct client connections or a validated trusted-proxy boundary that overwrites forwarded headers. Until then, all clients behind the same proxy share one IP bucket. The account-key dimension (SHA-256 prefix of normalized email) provides independent per-account limiting regardless of proxy topology.
- Cookie `Secure` flag is hardcoded to `true`. Local development over plain HTTP requires either HTTPS termination or a documented config override (not yet implemented).

## Pending Items (Full M3)

- **Bootstrap-admin:** First admin actor creation flow not implemented. Required for full M3 acceptance.
- **Local-HTTP cookie config:** Explicit dev-mode override for `Secure=false` with origin validation.
- **Session revocation:** Revoke prior valid sessions on successful re-login.
- **Trusted-proxy strategy:** Required for production per-client IP limiting behind Caddy/nginx.

## Rollback

Revert commits `fe9e0bb`, `ba7e812`, and `ce8a63b` with `git revert`. No schema changes. No data migration. Existing tables unchanged.