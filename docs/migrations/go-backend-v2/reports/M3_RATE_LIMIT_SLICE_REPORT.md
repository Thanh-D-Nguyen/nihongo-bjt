# M3 Rate Limit Slice Report

- **Date:** 2026-09-29
- **Scope:** Login abuse rate limiter (`internal/authn/ratelimit.go`), focused tests, safe peer-IP extraction wiring, removal of untrusted header middleware.
- **Status:** PASS (default suite). PG17 not required for this slice.
- **Not in scope:** Login handler security review, cookie attributes, session creation wiring, first-admin bootstrap (draft files remain uncommitted; see Pending Items).

## Changes

### `apps/api-go/internal/authn/ratelimit.go`
- Bounded in-memory fixed-window counter with hard `MaxKeys` cap (default 10,000).
- Fail-closed policy: unseen keys rejected with `ErrLimiterFull` when map is at capacity; no unbounded growth, no attacker-chosen victim eviction.
- Validated construction via `RateLimiterConfig` + `ValidateRateLimiterConfig`; rejects non-positive fields and `EvictEvery > TTL`.
- Background eviction goroutine with clean `Stop()` (idempotent via `sync.Once`).
- Injectable clock (`now func() time.Time`) for deterministic tests.
- No Redis dependency.

### `apps/api-go/internal/authn/ratelimit_test.go`
- `TestValidateRateLimiterConfig_RejectsInvalid`: zero/negative fields, evict > TTL.
- `TestNewRateLimiter_RejectsBadConfig`: constructor returns nil + error on bad config.
- `TestAllow_BasicWindowReset`: window expiry resets counter.
- `TestAllow_SameIPDifferentPortsShareBucket`: normalized IP key shares one bucket.
- `TestAllow_FullMapFailsClosed`: new key at capacity returns `ErrLimiterFull`; existing keys still work.
- `TestEvict_RemovesIdleKeys`: TTL-based eviction removes stale entries.
- `TestStop_IdempotentAndReleasesGoroutine`: multiple Stop calls safe.
- `TestAllow_ConcurrentAccess`: 50 goroutines × 20 requests, race-free.
- `TestAllow_ConcurrentFloodStaysBounded`: 100 goroutines vs MaxKeys=50, map never exceeds cap.
- `TestDefaultRateLimiterConfig_Validates`: defaults are valid.

### `apps/api-go/internal/httpserver/server.go`
- Removed `middleware.RealIP` to prevent unauthenticated clients from spoofing rate-limit keys via `X-Forwarded-For` / `X-Real-IP` headers.
- Documented Caddy shared-peer ceiling and account-key dimension as additional protection.

### `apps/api-go/internal/httpserver/handler_login.go` (uncommitted draft)
- Updated `Allow` call sites to handle two-value return `(bool, error)`; treats `ErrLimiterFull` as deny.
- **Not committed** — pending separate security review.

### `apps/api-go/internal/app/app.go` (uncommitted draft)
- Updated rate limiter construction to use `authn.NewRateLimiter(authn.DefaultRateLimiterConfig())` with error handling.
- Removed unused `"time"` import.
- **Not committed** — pending separate security review.

## Verification Evidence

```
$ cd apps/api-go && unset TEST_DATABASE_URL && go build ./...
---BUILD_EXIT:0---

$ go test ./...
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/app       0.738s
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/authn     (cached)
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/authz     (cached)
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/config    (cached)
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/credential(cached)
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/httpserver(cached)
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/session   (cached)
---TEST_EXIT:0---

$ go test -race ./internal/authn/...
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/authn     (cached)
---RACE_EXIT:0---

$ go vet ./...
---VET_EXIT:0---

$ gofmt -l internal/authn/
(clean)
```

**Default suite:** All packages PASS, 0 failures.
**Race detector:** PASS on authn package.
**Vet:** Clean.
**Gofmt:** Clean.

## Skipped Gates

| Gate | Reason |
|------|--------|
| PG17 integration tests | Not required for in-memory limiter. |
| Full M3 PASS | Login handler, cookie security, session creation, and first-admin bootstrap remain unreviewed drafts. |

## Pending Items (Uncommitted Drafts)

The following files exist as uncommitted drafts and are **not** part of this checkpoint:

- `internal/httpserver/handler_login.go` — Login handlers. Known issues: cookie security attributes need review, malformed record handling needs audit, credential verification error paths need review.
- Modifications in `internal/app/app.go`, `internal/authz/rbac.go`, `internal/httpserver/server.go`, `internal/profile/store.go` — Wiring for login/rate-limit. Not reviewed for safety.

These drafts compile but have not been security-reviewed or tested. They remain uncommitted per task instructions. Full M3 acceptance requires separate review and repair of these components.

## Security Notes

- `middleware.RealIP` removed: untrusted forwarded headers can no longer spoof rate-limit keys. Peer IP derived from `r.RemoteAddr` (host only) in the login handler's `normalizeIP` helper.
- When deployed behind Caddy (or equivalent trusted proxy), the proxy must overwrite `X-Forwarded-For` to prevent the shared-peer ceiling from collapsing all clients behind the proxy into one bucket. The account/email key dimension provides additional cardinality protection.
- `ErrLimiterFull` fails closed: at capacity, new keys are denied rather than evicting an attacker-chosen victim or growing unbounded.

## Rollback

This commit is additive. Revert with `git revert <commit-sha>`. No schema changes. No data migration. Existing tables unchanged. To restore `middleware.RealIP`, re-add it to `server.go` after proving the proxy boundary is cryptographically enforced.