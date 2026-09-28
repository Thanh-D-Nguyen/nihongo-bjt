# M3 Auth Infrastructure Report (Independent Partial Wave)

## Identification
- **Starting HEAD**: `d9f527ef` (verified at session start)
- **Accepted M3 partial code**: `0d59a786` (session/RBAC from prior repair)
- **Branch**: `main`
- **Wave**: M3 — Independent auth infrastructure (credential gate remains pending)
- **Date**: 2026-09-28
- **Accepted M2 persistence checkpoint**: `9c98bad90628d1ca24f71c3034aa3d4a63bf8851`

## Scope
First-party Argon2id credential hashing, HTTP session guards for learner/admin cookie auth, and CSRF defense for unsafe methods. No login endpoints, no Keycloak legacy verifier, no production credential migration, no routing cutover. Production Keycloak credential format remains GATED_UNKNOWN_PRODUCTION.

## Artifacts Created

| Artifact | Path | Status |
|---|---|---|
| Argon2id hasher/verifier | `apps/api-go/internal/credential/argon2.go` | CREATED |
| Argon2id tests | `apps/api-go/internal/credential/argon2_test.go` | CREATED |
| HTTP session guard middleware | `apps/api-go/internal/authn/guard.go` | CREATED |
| Guard tests | `apps/api-go/internal/authn/guard_test.go` | CREATED |
| CSRF defense middleware | `apps/api-go/internal/authn/csrf.go` | CREATED |
| CSRF tests | `apps/api-go/internal/authn/csrf_test.go` | CREATED |
| M3 auth infra report | `docs/migrations/go-backend-v2/reports/M3_AUTH_INFRA_REPORT.md` | CREATED (this file) |

## Credential Package Design

### Argon2id Implementation (`internal/credential/argon2.go`)
- **Algorithm**: Argon2id v1.3 (PHC string format: `$argon2id$v=19$m=<mem>,t=<iter>,p=<par>$<salt>$<hash>`)
- **Default parameters**: Memory=65536 KiB, Iterations=3, Parallelism=2, SaltLen=16, HashLen=32
- **Parameter bounds**: Memory [1, 131072] KiB, Iterations [1, 6], Parallelism [1, 4], SaltLen [1, 64], HashLen [1, 64]; password input ≤1024 bytes. OCI A1 benchmarking remains required before production login.
- **Salt generation**: `crypto/rand` for each hash; never reused
- **Verification**: Constant-time comparison via `subtle.ConstantTimeCompare` on decoded hash bytes
- **Decode validation**: Validates algorithm ID, version, parameter bounds before conversion, duplicate keys, base64 encoding, non-empty salt/hash, and max record length (512 bytes). Derives SaltLen/HashLen from decoded bytes.
- **Error types**: `ErrMismatch`, `ErrMalformedRecord`, `ErrUnsupportedAlgo`, `ErrInvalidParams`, `ErrPasswordTooLong`; future login handlers must normalize responses to avoid account enumeration.
- **No hardcoded secrets**: All parameters are explicit; `DefaultParams()` returns a value copy

### Tests (`internal/credential/argon2_test.go`)
- Correct password verifies successfully
- Wrong password returns `ErrMismatch`
- Two hashes of same password produce different encoded strings (unique salts)
- Malformed records rejected: empty, too few segments, wrong algorithm, bad version, missing params, zero/oversized memory/iterations/parallelism, empty salt/hash, invalid base64, oversized record
- `Verify` on malformed input returns error (not `ErrMismatch`)
- Parameter bounds validation for all fields
- Default params pass validation
- Self-describing format verified (6 dollar-separated segments, `$argon2id$` prefix)

## HTTP Session Guards (`internal/authn/guard.go`)

### LearnerGuard
- Reads cookie `bjt_web_session` (configurable)
- Calls `store.LookupLearnerSession(ctx, raw)` which validates token format, checks expiry/revocation, and joins `profile.user_profile` requiring `status='active'`
- Injects `LearnerIdentity{SessionID, UserID}` into request context
- Returns 401 JSON for missing/invalid/expired/revoked/disabled sessions
- Never logs raw token values; error responses are fixed strings

### AdminGuard
- Reads cookie `bjt_admin_session` (configurable)
- Calls `store.LookupAdminSession(ctx, raw)` with same validation + `authz.admin_actor.status='active'` join
- Injects `AdminIdentity{SessionID, ActorID}` into request context
- Namespace isolation: learner cookie rejected by admin guard and vice versa (different cookie names)

### Context Extraction
- `GetLearnerIdentity(ctx)` / `GetAdminIdentity(ctx)` return typed identity + bool
- Unexported context keys prevent cross-package collision

### Tests (`internal/authn/guard_test.go`)
- Missing cookie → 401 for both guards
- Empty context → no identity extracted
- Default cookie names match spec (`bjt_web_session`, `bjt_admin_session`)
- Cookie extraction: present, missing, whitespace-trimmed
- Namespace isolation: admin cookie rejected by learner guard, learner cookie rejected by admin guard
- Valid learner/admin session → identity in context; missing/invalid session → 401; backend error → 500; raw token absent from captured logs

## CSRF Defense (`internal/authn/csrf.go`)

### Design
- Origin-based validation for unsafe methods (POST, PUT, PATCH, DELETE)
- Safe methods (GET, HEAD, OPTIONS) pass through unconditionally
- Explicit trusted origins allowlist from config; **fail closed** when empty
- Prefers `Origin` header; falls back to `Referer` URL parsing
- Strict URL parsing; path-bearing `Origin` and malformed trusted-origin configuration fail closed
- Logs untrusted/missing origin events at WARN level without sensitive data

### Tests (`internal/authn/csrf_test.go`)
- Safe methods pass through (GET, HEAD, OPTIONS)
- Unsafe method + missing origin → 403
- Unsafe method + untrusted origin → 403
- Unsafe method + trusted origin → 200
- Empty trusted origins list rejects all unsafe requests (fail closed)
- Referer fallback works for trusted origin
- Referer fallback rejects untrusted origin
- Invalid trusted-origin config and path-bearing `Origin` are rejected
- Origin header takes precedence over Referer
- Neither header present → empty string extracted

## Dependency Changes
- Added `golang.org/x/crypto v0.37.0` (Go 1.23 compatible) for `argon2` and `subtle` packages
- `go.mod` and `go.sum` updated via `go mod tidy`

## Verification Results

### Go Toolchain (all with GOTOOLCHAIN=go1.23.0)
| Check | Command | Result |
|---|---|---|
| gofmt | `gofmt -w . && test -z "$(gofmt -l .)"` | ✅ CLEAN |
| go vet | `go vet ./...` | ✅ PASS |
| go test | `go test ./...` | ✅ PASS (credential: 1.184s, authn: cached, all others pass) |
| go test -race | `go test -race ./...` | ✅ PASS (credential: 8.941s, authn: 1.428s, session: 2.493s, authz: 1.792s) |
| ARM64 build | `GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -o /tmp/api-go-m3-auth-infra ./cmd/api` | ✅ PASS |

### Integration Tests
- Session and authz integration tests require `TEST_DATABASE_URL` pointing at disposable PostgreSQL 17 with M2 schema
- Without `TEST_DATABASE_URL`: integration tests SKIP (not FAIL); unit tests all PASS
- Session/RBAC PostgreSQL 17 integration passed twice in the prior M3 partial checkpoint. This auth-infrastructure wave did not rerun those database tests; its new guard tests use a lookup seam.

## Security Properties Verified
1. **No raw tokens in logs or error responses**: Guards use fixed JSON error strings; credential package errors are typed without internal details
2. **Constant-time hash comparison**: `subtle.ConstantTimeCompare` on decoded bytes in `Verify()`
3. **Fail-closed CSRF**: Empty trusted origins list rejects all unsafe requests
4. **Namespace isolation**: Different cookie names prevent cross-realm session acceptance
5. **Status-gated lookups**: Disabled accounts cannot authenticate even with valid session tokens
6. **Owner-scoped revocation**: Revoke requires both session ID and owner ID
7. **Token format validation**: 64 hex chars required before DB lookup; prevents unbounded hashing
8. **Expiry validation**: Create rejects past expiry; lookup filters expired sessions
9. **Digest-only storage**: Raw tokens never persisted; only SHA-256 digests stored
10. **Parameter bounds**: Argon2 parameters validated against DoS-preventing limits

## What Was NOT Implemented (By Design)
- **Login/password endpoints**: BLOCKED on production Keycloak credential format confirmation (GATED_UNKNOWN_PRODUCTION)
- **Keycloak legacy verifier**: Not implemented; production format unverified
- **Session rotation**: Deferred; no safe atomic integration point without login endpoints
- **Rate limiting**: Deferred to actual login endpoint implementation
- **Routing cutover**: No Go routes mounted for auth; NestJS remains authoritative
- **Caddy signed URL logic**: Not applicable without media cutover

## Rollback
- All changes are additive Go packages under `apps/api-go/internal/`
- No NestJS, database schema, or deployment changes
- Removing `internal/credential/` and `internal/authn/` directories fully reverts this wave
- `go.mod`/`go.sum` changes limited to `golang.org/x/crypto` addition

## M3 Full Gate Status
**BLOCKED** — Production Keycloak credential format remains GATED_UNKNOWN_PRODUCTION.

Required action to unblock M3 full:
1. Obtain read access to production Keycloak DB or Admin REST API
2. Query credential metadata for `nihongo-bjt` realm users (algorithm/parameters only)
3. Compare with dev defaults (Argon2id v1.3, m=7168, t=5, p=1, len=32)
4. If match → implement legacy verifier with confirmed parameters
5. If differ → adjust verifier accordingly
6. Document findings before proceeding

M3 independent auth infrastructure (this wave) is complete and verified. M3 full requires credential gate resolution.
