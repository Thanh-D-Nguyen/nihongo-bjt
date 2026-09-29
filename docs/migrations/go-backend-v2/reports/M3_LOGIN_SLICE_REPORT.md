# M3 Login Slice Report

- **Date:** 2026-09-29
- **Scope:** Learner/admin first-party password login handlers (`internal/httpserver/handler_login.go`), route/composition wiring (`server.go`, `app.go`), profile/authz store lookups (`profile/store.go`, `authz/rbac.go`), dedicated security tests (`handler_login_test.go`).
- **Status:** PENDING — handler, wiring, store lookups, and unit/race/vet PASS from clean `git archive` snapshot. PG17 integration tests SKIPPED (database unavailable in this environment). Full M3 remains PENDING until bootstrap-admin and PG17 verification.
- **Not in scope:** Bootstrap-admin, M4, identity cleanup, trusted-proxy strategy, rate limiter shutdown wiring.

## Changes

### `apps/api-go/internal/httpserver/handler_login.go`
- `learnerLoginHandler` and `adminLoginHandler`: POST-only, Content-Type enforcement, bounded body (4096 bytes), strict JSON decode with trailing-token rejection.
- Email normalized to lowercase+trimmed; empty email/password and oversized password return generic 401 with constant-time burn.
- Rate limiting: fail-closed if `rateLimiter == nil` (503); dual-key bucketing via `authn.NormalizePeerIP(r.RemoteAddr)` for IP dimension and SHA-256 prefix of normalized email for account dimension. No raw email in map or logs. Spoofed forwarding headers ignored (middleware.RealIP already removed).
- Credential verification: all credential errors (`ErrMismatch`, `ErrCredentialNotFound`, `ErrMalformedRecord`, `ErrUnsupportedAlgo`, `ErrInvalidParams`) return generic 401 with burn; DB/backend errors return safe 500 with structured log (no secret leakage).
- Session creation via `session.Store.CreateLearnerSession` / `CreateAdminSession` with high-entropy opaque token persisted as digest; new token on every login (fixation prevention).
- Cookie attributes: `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, expiry aligned to DB session TTL (24h). Separate cookie names (`bjt_web_session`, `bjt_admin_session`) enforce namespace isolation.
- No secret/token/password logging anywhere in handler paths.

### `apps/api-go/internal/httpserver/server.go`
- Restored `CredentialStore` and `RateLimiter` fields in `Dependencies`.
- Login routes wired under CSRF guard: `/api/auth/login` requires CredentialStore + ProfileStore + SessionStore + RateLimiter; `/api/admin/login` requires CredentialStore + RBACStore + SessionStore + RateLimiter. Routes only registered when all dependencies are non-nil.
- `middleware.RealIP` remains removed (accepted in rate-limit slice).

### `apps/api-go/internal/app/app.go`
- Constructs `credential.NewStore(dbPool)` and `authn.NewRateLimiter(authn.DefaultRateLimiterConfig())` with error handling; passes both to `httpserver.Dependencies`.
- Rate limiter lifecycle: constructed at startup; `Stop()` must be called on shutdown (wiring deferred to app shutdown hook in future slice).

### `apps/api-go/internal/profile/store.go`
- Added `GetLearnerByEmail(ctx, email) (*LearnerPublicProfile, error)`: looks up active learner by normalized email; returns `(nil, nil)` for unknown to prevent enumeration. Required for login handler compilation from clean HEAD.

### `apps/api-go/internal/authz/rbac.go`
- `GetActiveActorIDByEmail` already existed in uncommitted draft; confirmed present and removed accidental duplicate appended during repair. Required for admin login handler compilation from clean HEAD.

### `apps/api-go/internal/httpserver/handler_login_test.go`
- 22 tests exercising actual HTTP router/handlers against real stores:
  - **Success:** learner/admin login sets Secure HttpOnly SameSite=Lax cookie; session exists in DB with correct UserID/ActorID.
  - **Generic 401:** wrong password, unknown email, disabled user/actor, missing credential, empty fields.
  - **Input validation:** oversized body (413), trailing JSON (400), wrong Content-Type (400).
  - **CSRF:** missing Origin (403), untrusted Origin (403).
  - **Rate limiting:** nil limiter fail-closed (503), IP limit exceeded (429), same IP different ports share bucket (429), forged X-Forwarded-For/X-Real-IP ignored (429), full map fail-closed (429).
  - **Fixation prevention:** two consecutive logins produce different tokens.
  - **Namespace isolation:** learner cookie rejected on admin session endpoint.

## Verification Evidence (clean `git archive` snapshot at HEAD ba7e812)

```
$ git log --oneline -6
ba7e8121 fix(api-go): add GetLearnerByEmail to profile store for login handler compilation
ce8a63b2 feat(api-go): add learner/admin password login with rate limiting and security tests
52e3e6a5 fix(api-go): move NormalizePeerIP to production code with validated host extraction
bf9bc14e fix(api-go): defer login routes and add NormalizePeerIP to make rate-limit slice self-contained
dc22845b feat(api-go): add bounded login abuse rate limiter with fail-closed policy
a6fc9aee docs(m3): record verified PG17 credential evidence

$ TMPDIR=$(mktemp -d) && git archive HEAD | tar -x -C "$TMPDIR" && cd "$TMPDIR/apps/api-go"
$ unset TEST_DATABASE_URL && go build ./...
---BUILD_EXIT:0---
$ go test ./...
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/app         0.797s
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/authn       1.498s
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/authz       2.825s
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/config      1.813s
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/credential  3.287s
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/httpserver  3.721s
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/session     3.191s
---TEST_EXIT:0---
$ go test -race ./internal/httpserver/... ./internal/authn/... ./internal/authz/...
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/httpserver  2.399s
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/authn       1.646s
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/authz       2.996s
---RACE_EXIT:0---
$ go vet ./...
---VET_EXIT:0---
$ gofmt -l .
(clean)
```

**Default suite:** All packages PASS, 0 failures, from clean archive.
**Race detector:** PASS on httpserver, authn, and authz packages.
**Vet:** Clean.
**Gofmt:** Clean.

## Skipped Gates

| Gate | Reason |
|------|--------|
| PG17 integration tests (`-count=2`) | `TEST_DATABASE_URL` not set; local PostgreSQL 17 unavailable (role "postgres" does not exist). Tests require disposable PG17 with M2 schema. |
| Linux/arm64 cross-build | Not executed; no cross-compilation target configured in this environment. |
| Rate limiter Stop lifecycle on shutdown | `app.go` constructs the limiter but does not yet wire `Stop()` into graceful shutdown. Documented as follow-up. |
| Trusted-proxy strategy | Not implemented. All clients behind a reverse proxy share the proxy's peer IP. Account-key dimension provides additional cardinality protection. |

## Operational Ceiling

- Per-client IP rate limiting requires either direct client connections or a validated trusted-proxy boundary that overwrites forwarded headers. Until then, all clients behind the same proxy share one IP bucket. The account-key dimension (SHA-256 prefix of normalized email) provides independent per-account limiting regardless of proxy topology.
- Cookie `Secure` flag is hardcoded to `true`. Local development over plain HTTP requires either HTTPS termination or a documented config override (not yet implemented).

## Pending Items

- **Bootstrap-admin:** First admin actor creation flow not implemented. Required for full M3 acceptance.
- **Rate limiter shutdown:** `RateLimiter.Stop()` not wired into app graceful shutdown.
- **PG17 integration verification:** All 22 login tests must pass against disposable PG17 with M2 schema before slice can be marked PASS.
- **Linux/arm64 build verification:** Cross-compilation check deferred.
- **Trusted-proxy strategy:** Required for production per-client IP limiting behind Caddy/nginx.

## Rollback

Revert commits `ba7e812` and `ce8a63b` with `git revert`. No schema changes. No data migration. Existing tables unchanged.