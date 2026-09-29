# M3 Rate Limit Slice Report

- **Date:** 2026-09-29
- **Scope:** Login abuse rate limiter (`internal/authn/ratelimit.go`), production peer-IP normalization helper, focused tests, removal of untrusted header middleware, deferred login handler wiring.
- **Status:** PASS (default suite). Clean HEAD compiles without uncommitted drafts. PG17 not required for this slice.
- **Not in scope:** Login handler security review, cookie attributes, session creation wiring, first-admin bootstrap (draft files remain uncommitted; see Pending Items).

## Changes

### `apps/api-go/internal/authn/ratelimit.go`
- Bounded in-memory fixed-window counter with hard `MaxKeys` cap (default 10,000).
- Fail-closed policy: unseen keys rejected with `ErrLimiterFull` when map is at capacity; no unbounded growth, no attacker-chosen victim eviction.
- Validated construction via `RateLimiterConfig` + `ValidateRateLimiterConfig`; rejects non-positive fields and `EvictEvery > TTL`.
- Background eviction goroutine with clean `Stop()` (idempotent via `sync.Once`).
- Injectable clock (`now func() time.Time`) for deterministic tests.
- `NormalizePeerIP(remoteAddr string) string`: production helper that extracts host from RemoteAddr using `net.SplitHostPort`, validates extracted host via `net.ParseIP` or DNS hostname check, maps malformed/empty input to stable `"unknown"` key. Does NOT consult X-Forwarded-For or X-Real-IP headers. Available for login handler use when wired.
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
- `TestNormalizePeerIP_StripsPortAndHandlesMalformed`: IPv4/IPv6/bare/malformed cases against production helper.
- `TestNormalizePeerIP_DifferentPortsShareKey`: two ports → same bucket via production helper, limit enforced.
- `TestNormalizePeerIP_MalformedMapsToStableBucket`: all malformed inputs share one `"unknown"` bucket; prevents garbage-address flood bypass.
- `TestNormalizePeerIP_DependsOnlyOnRemoteAddr`: documents function depends only on input string, not external state; does NOT claim end-to-end HTTP protection (handler not yet wired).

### `apps/api-go/internal/httpserver/server.go`
- Removed `middleware.RealIP` to prevent unauthenticated clients from spoofing rate-limit keys via `X-Forwarded-For` / `X-Real-IP` headers.
- Login routes (`/api/auth/login`, `/api/admin/login`) intentionally deferred; commented placeholder documents prerequisites for re-enablement.
- `Dependencies` struct no longer includes `CredentialStore` or `RateLimiter` fields (login wiring deferred).

### Uncommitted Drafts (NOT part of this checkpoint)
- `internal/httpserver/handler_login.go` — Updated `Allow` call sites to handle two-value `(bool, error)` return; treats `ErrLimiterFull` as deny. Pending security review.
- `internal/app/app.go` — Constructs credential store and rate limiter but does not wire them into `httpserver.Dependencies` (deferred). Removed unused `"time"` import. Pending security review.

## Verification Evidence

```
$ cd apps/api-go && unset TEST_DATABASE_URL && go build ./...
---BUILD_EXIT:0---

$ go test ./...
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/app        0.562s
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/authn      0.643s
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/authz      (cached)
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/config     (cached)
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/credential (cached)
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/httpserver (cached)
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/session    (cached)
---TEST_EXIT:0---

$ go test -race ./internal/authn/...
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/authn  1.964s
---RACE_EXIT:0---

$ go vet ./...
---VET_EXIT:0---

$ gofmt -l internal/authn/
(clean)
```

**Default suite:** All packages PASS, 0 failures.
**Race detector:** PASS on authn package (14 tests including concurrency/flood/normalization).
**Vet:** Clean.
**Gofmt:** Clean.

## Operational Ceiling

`NormalizePeerIP` derives keys solely from `r.RemoteAddr`. When deployed behind a reverse proxy (Caddy, nginx, etc.) without a validated trusted-proxy strategy, all clients share the proxy's peer IP and thus one rate-limit bucket. Per-client IP limiting requires either:
1. A cryptographically enforced proxy boundary that overwrites forwarded headers, OR
2. Account/email key dimension as the primary limiter key (already supported by the limiter's string-key design).

This slice provides the helper and bounded limiter infrastructure. End-to-end per-client IP enforcement is NOT claimed until the login handler is wired and the proxy trust boundary is validated.

## Skipped Gates

| Gate | Reason |
|------|--------|
| PG17 integration tests | Not required for in-memory limiter. |
| Full M3 PASS | Login handler, cookie security, session creation, and first-admin bootstrap remain unreviewed drafts. |
| End-to-end header-spoofing test | Login handler not wired; cannot test HTTP-level behavior yet. |

## Pending Items (Uncommitted Drafts)

The following files exist as uncommitted drafts and are **not** part of this checkpoint:

- `internal/httpserver/handler_login.go` — Login handlers. Known issues: cookie security attributes need review, malformed record handling needs audit, credential verification error paths need review. Must use `authn.NormalizePeerIP(r.RemoteAddr)` for IP key derivation.
- Modifications in `internal/app/app.go`, `internal/authz/rbac.go`, `internal/httpserver/server.go`, `internal/profile/store.go` — Wiring for login/rate-limit. Not reviewed for safety.

These drafts compile but have not been security-reviewed or tested. They remain uncommitted per task instructions. Full M3 acceptance requires separate review and repair of these components.

## Rollback

This commit is additive. Revert with `git revert <commit-sha>`. No schema changes. No data migration. Existing tables unchanged. To restore `middleware.RealIP`, re-add it to `server.go` after proving the proxy boundary is cryptographically enforced.