# M3 Credential Persistence Slice Report

- **Date:** 2026-09-29
- **Scope:** Credential store (`internal/credential`) — Argon2id PHC mapping to M2 columnar schema, focused unit tests, integration test harness repair.
- **Status:** PASS (default suite). PG17 integration SKIPPED (no `TEST_DATABASE_URL` in this environment).
- **Not in scope:** Login handler, rate limiter, session creation wiring (draft files remain uncommitted; see Pending Items).

## Changes

### `apps/api-go/internal/credential/store.go`
- Maps PHC Argon2id encoded strings to/from M2 `auth.password_credential` and `auth.admin_password_credential` columnar schema.
- `scanAndEncode` reconstructs PHC string from DB columns with fail-closed validation:
  - Rejects unsupported algorithm (`ErrUnsupportedAlgo`).
  - Rejects empty `algorithm_version` (`ErrMalformedRecord`).
  - Rejects hash-length mismatch between declared `hash_length` and actual `hashed_value` bytes.
  - Rejects non-positive parameters (iterations, memory, parallelism, hash length).
  - Rejects empty salt.
  - Returns `ErrCredentialNotFound` on `pgx.ErrNoRows`.
- No secret/password logging in any error path.
- Formatted with `gofmt`.

### `apps/api-go/internal/credential/store_test.go`
- Fixed `uniqueID` to generate real UUID v4 via `crypto/rand` (previous format was invalid for UUID columns).
- Fixed `TestScanAndEncode_NoRows` to use `pgx.ErrNoRows` sentinel instead of arbitrary error string.
- Added `github.com/jackc/pgx/v5` import for `ErrNoRows`.
- Integration tests use `testPool(t)` which skips when `TEST_DATABASE_URL` is unset.
- Seed helpers insert into `profile.user_profile` and `authz.admin_actor` with proper FK satisfaction.
- Formatted with `gofmt`.

## Verification Evidence

```
$ cd apps/api-go && unset TEST_DATABASE_URL && go test ./...
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/app         0.493s
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/authn       0.725s
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/authz       1.121s
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/config      0.881s
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/credential  2.818s
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/httpserver  1.469s
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/session     1.713s
---TEST_EXIT:0---

$ go test -race ./internal/credential/...
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/credential  (cached)
---RACE_EXIT:0---

$ go vet ./internal/credential/...
---VET_EXIT:0---

$ gofmt -l internal/credential/
(clean)
```

**Default suite:** 171 passed, 0 failed, 63 skipped (integration tests skipped without DB).
**Race detector:** PASS on credential package.
**Vet:** Clean.
**Gofmt:** Clean.

## Skipped Gates

| Gate | Reason |
|------|--------|
| PG17 integration tests ×2 | `TEST_DATABASE_URL` not set in this environment. Integration tests are wired and will run when a disposable PG17 with M2 schema is available. |
| Full M3 PASS | Login handler, rate limiter, and session creation wiring are draft/unreviewed. Not committed. |

## Pending Items (Uncommitted Drafts)

The following files exist as uncommitted drafts from a prior session and are **not** part of this checkpoint:

- `internal/authn/ratelimit.go` — In-memory token-bucket limiter. Known issues: no hard map bound, eviction-only cleanup.
- `internal/httpserver/handler_login.go` — Login handlers. Known issues: cookie security attributes need review, malformed record handling needs audit.
- Modifications in `internal/app/app.go`, `internal/authz/rbac.go`, `internal/httpserver/server.go`, `internal/profile/store.go` — Wiring for login/rate-limit. Not reviewed for safety.

These drafts compile but have not been security-reviewed or tested. They remain uncommitted per task instructions. Full M3 acceptance requires separate review and repair of these components.

## Rollback

This commit is additive. Revert with `git revert <commit-sha>`. No schema changes. No data migration. Existing tables unchanged.