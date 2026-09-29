# M3 Rate Limit Slice Report

- **Date:** 2026-09-29
- **Scope:** Login abuse rate limiter (`internal/authn/ratelimit.go`), focused tests, safe peer-IP extraction, removal of untrusted header middleware, deferred login handler wiring.
- **Status:** PASS (default suite). Clean HEAD compiles without uncommitted drafts. PG17 not required for this slice.
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
- `NormalizePeerIP`: exported helper that strips ephemeral port from RemoteAddr (IPv4, IPv6 bracketed, bare IPv6); does NOT consult X-Forwarded-For or X-Real-IP.
- `TestNormalizePeerIP_StripsPortAndIgnoresHeaders`: IPv4/IPv6/bare cases.
- `TestNormalizePeerIP_DifferentPortsShareKey`: two ports → same bucket, limit enforced.
- `TestNormalizePeerIP_ForgedHeadersDoNotAffectKey`: spoofed headers produce separate bucket, cannot bypass real-IP limit.

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
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/app         0.516s
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/authn       0.504s
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/authz       (cached)
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/config      (cached)
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/credential  (cached)
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/httpserver  (cached)
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/session     (cached)
---TEST_EXIT:0---

$ go test -race ./internal/authn/...
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/authn       1.488s
---RACE_EXIT:0---

$ go vet ./...
---VET_EXIT:0---

$ gofmt -l internal/authn/ internal/httpserver/server.go
(clean)
```

**Default suite:** All packages PASS, 0 failures.
**Race detector:** PASS on authn package (13 tests including concurrency/flood).
**Vet:** Clean.
**Gofmt:** Clean (handler