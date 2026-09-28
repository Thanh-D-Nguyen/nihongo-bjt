# M3 Partial Session Core Report

## Identification
- **Starting HEAD**: `b2c61e0d3a5b148922322e80e7e835be74feb719`
- **Accepted M2 persistence checkpoint**: `9c98bad90628d1ca24f71c3034aa3d4a63bf8851`
- **Branch**: `main`
- **Wave**: M3_PARTIAL — Session token + RBAC loader (credential gate pending)
- **Date**: 2026-09-28
- **Credential gate status**: GATED_UNKNOWN_PRODUCTION (unchanged from M2)

## Scope Completed
Session token generation, digest-only persistence, admin RBAC permission loading, and integration tests against disposable PostgreSQL 17. No login/password endpoints, no Keycloak verifier, no credential migration, no production auth routing.

### Packages Added
| Package | Path | Purpose |
|---|---|---|
| `session` | `apps/api-go/internal/session/` | Opaque 256-bit token generation, SHA-256 digest utilities, learner/admin session CRUD against `auth.session` / `auth.admin_session` |
| `authz` | `apps/api-go/internal/authz/` | Admin principal loading with role→permission expansion from `authz.*` tables |

### Files Created
| File | Description |
|---|---|
| `internal/session/token.go` | `GenerateToken()` (crypto/rand 32 bytes → hex), `HashToken()`, `ConstantTimeDigestEqual()` |
| `internal/session/store.go` | `Store` with Create/Lookup/Revoke for learner and admin sessions; bounded contexts; constant-time digest lookup |
| `internal/session/token_test.go` | Unit tests: length, uniqueness (100 iterations), determinism, hex validity, constant-time comparison |
| `internal/session/store_test.go` | Integration tests (7): create+lookup learner, not-found, expired filter, revoke single, create+lookup admin, revoke-all admin, learner-token-cannot-lookup-admin |
| `internal/authz/rbac.go` | `Store.LoadPrincipal()` with LEFT JOIN expansion; wildcard `*` semantics; disabled actor detection |
| `internal/authz/rbac_test.go` | Integration tests (4): permissions loaded, wildcard grants all, disabled actor returns ErrActorNotActive, missing actor returns ErrActorNotActive; unit test for HasAnyPermission without wildcard |

## Architecture Decisions
1. **Digest-only storage**: Raw tokens are returned exactly once at creation; only SHA-256 hex digests are persisted. No plaintext tokens in database.
2. **Constant-time comparison**: `LookupLearnerSession` and `LookupAdminSession` hash the input token then compare via SQL equality on the digest column. `ConstantTimeDigestEqual` exported for future middleware use.
3. **Namespace isolation**: Learner sessions (`auth.session`) and admin sessions (`auth.admin_session`) are separate tables with separate lookup methods. A learner token cannot resolve as an admin session (verified by test).
4. **Bounded contexts**: All DB operations use 5-second context timeouts to prevent unbounded blocking.
5. **RBAC wildcard**: `HasPermission("*")` returns true for any code, matching NestJS `AdminAuthService` behavior. Wildcard is stored as a literal `"*"` permission code in `authz.admin_permission`.
6. **Disabled actor guard**: `LoadPrincipal` filters `WHERE a.status = 'active'`; disabled or missing actors return `ErrActorNotActive`. No permissions are loaded for inactive actors.
7. **No Redis authority**: Session state is PostgreSQL-authoritative. Redis remains available for ephemeral concerns (presence, caching) but is not in the session lookup path.
8. **No HTTP middleware yet**: Session/RBAC packages are pure data-layer. HTTP middleware for cookie/header extraction and context injection is deferred until credential gate passes and login endpoints exist.

## Verification Results

### Go Toolchain (all with GOTOOLCHAIN=go1.23.0)
| Check | Command | Result |
|---|---|---|
| gofmt | `gofmt -w . && test -z "$(gofmt -l .)"` | ✅ CLEAN |
| go vet | `go vet ./...` | ✅ PASS |
| go test (unit) | `go test ./internal/session/... ./internal/authz/... -short` | ✅ PASS (6 unit tests) |
| go test -race | `go test -race ./internal/session/... ./internal/authz/... -short` | ✅ PASS |
| ARM64 build | `GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build ./cmd/api` | ✅ PASS |

### Integration Tests (disposable postgres:17-alpine)
| Check | Result |
|---|---|
| Container start | ✅ `postgres:17-alpine` on port 15433 |
| Schema setup | ✅ Parent tables + M2 migration applied cleanly |
| Session tests (7) | ✅ ALL PASS |
| RBAC tests (4+1) | ✅ ALL PASS |
| Total integration | ✅ 17/17 PASS |
| Container cleanup | ✅ Removed |

### Test Coverage Summary
| Category | Count | Status |
|---|---|---|
| Token generation unit tests | 5 | ✅ PASS |
| RBAC unit test (HasAnyPermission) | 1 | ✅ PASS |
| Session integration tests | 7 | ✅ PASS |
| RBAC integration tests | 4 | ✅ PASS |
| **Total** | **17** | **✅ ALL PASS** |

## Security Invariants Verified
1. **No plaintext tokens**: Only SHA-256 digests stored; raw token returned once at generation.
2. **Constant-time digest comparison**: Exported `ConstantTimeDigestEqual` uses `crypto/subtle`.
3. **Namespace isolation**: Learner/admin sessions in separate tables; cross-namespace lookup returns `ErrSessionNotFound` (tested).
4. **Expiry enforcement**: SQL `WHERE expires_at > now()` filters expired sessions (tested).
5. **Revocation enforcement**: SQL `WHERE revoked_at IS NULL` filters revoked sessions (tested).
6. **Disabled actor rejection**: `LoadPrincipal` returns `ErrActorNotActive` for non-active actors (tested).
7. **Bounded contexts**: All operations have 5s timeouts; no unbounded DB calls.
8. **No secrets in code/logs**: Token generation uses `crypto/rand`; no hardcoded secrets.

## Pending M3 Work (Blocked by Credential Gate)
| Item | Blocker | Notes |
|---|---|---|
| Password verifier (Argon2id) | Production Keycloak credential format UNVERIFIED | Cannot choose parameters or implement legacy verifier |
| Login endpoint (learner) | Credential gate | Requires verified hash format + benchmarked Go parameters |
| Login endpoint (admin) | Credential gate | Same |
| HTTP session middleware | Login endpoints | No auth flow to protect yet |
| CSRF protection | Cookie-based auth endpoints | Speculative without login endpoints |
| Rate limiting on auth | Login endpoints | Speculative without login endpoints |
| Password reset/change flow | Credential gate | Requires verified hash format |
| Session refresh/sliding expiry | Product decision | May defer to post-gate |

## Credential Gate Action Required
**Status**: GATED_UNKNOWN_PRODUCTION (unchanged from M2)

**Next action**: Obtain read access to production Keycloak DB or Admin REST API for the `nihongo-bjt` realm. Query credential metadata (algorithm, parameters only — NEVER extract hashes/salts). Compare with dev defaults (Argon2id v1.3, m=7168, t=5, p=1, len=32). If match → Approach B feasible; if differ → adjust. Document findings before implementing any verifier.

## Rollback
Code-level only. The `session` and `authz` packages are additive Go code with no schema changes. Removing the packages leaves M2 tables intact. No destructive operations performed.

## Artifact List
| Artifact | Path | Status |
|---|---|---|
| Session token utilities | `apps/api-go/internal/session/token.go` | CREATED |
| Session store | `apps/api-go/internal/session/store.go` | CREATED |
| Session token tests | `apps/api-go/internal/session/token_test.go` | CREATED |
| Session store tests | `apps/api-go/internal/session/store_test.go` | CREATED |
| Admin RBAC loader | `apps/api-go/internal/authz/rbac.go` | CREATED |
| Admin RBAC tests | `apps/api-go/internal/authz/rbac_test.go` | CREATED |
| M3 partial report | `docs/migrations/go-backend-v2/reports/M3_PARTIAL_SESSION_CORE_REPORT.md` | CREATED |
| Orchestration state | `docs/migrations/go-backend-v2/ORCHESTRATION_STATE.md` | UPDATED |