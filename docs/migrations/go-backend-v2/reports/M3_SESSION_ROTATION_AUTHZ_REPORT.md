# M3 Session Rotation + Admin Authorization Report

## Identification
- **Starting HEAD**: `a0522664` (accepted M3 independent auth infra code)
- **Branch**: `main`
- **Wave**: M3 — Session rotation + admin authorization middleware (independent of credential gate)
- **Date**: 2026-09-28
- **Accepted M3 infra checkpoint**: `a0522664`
- **Cumulative M3 remainder commits** (after accepted base `a0522664`):
  - `a2dd34d0` — initial rotation/authz scaffold
  - `02fd4874` — implementation (bounded txCtx, atomic rotation, middleware)
  - `621320b0` — repair round 1 (test helper deletion staged, unexported context key, generic deny)
  - `3c4603d1` — coverage/helper removal (direct rotation rejection tests, testing.go deletion confirmed)
  - `c45eddbc` — final repair (admin revoked-token rotation test, txCtx wording corrected)
- `7db1e777` — documentation-only report correction (cumulative commits, rollback, ARM64 path)
- `<pending>` — test harness fix: seedRoleWithPermission distinct placeholders for varchar/text; production-like PG17 verification

## Scope
Atomic learner/admin session rotation in `session.Store`; composed admin authorization middleware (`AdminGuard` → `RequirePermission`/`RequireAnyPermission`) using existing `authz.Store.LoadPrincipal`; PostgreSQL 17 integration tests for rotation and RBAC against disposable DB. No login endpoints, no credential verifier, no client routing changes, no schema migration. Production Keycloak credential format remains GATED_UNKNOWN_PRODUCTION; this work is independent.

## Repair Summary (REVISE of a2dd34d0)

Independent review identified five blocking findings. All addressed:

1. **Deleted production test helper**: Removed `apps/api-go/internal/authn/testing.go` which exported `WithAdminIdentity`/`WithLearnerIdentity` context fabricators in the production package. Rewrote `apps/api-go/internal/authz/middleware_test.go` to exercise the real `authn.AdminGuard` chain with a mock `SessionLookup` seam, proving the actual boundary without bypass hooks. Tests cover missing cookie, invalid session, successful identity injection, permission allow/deny/wildcard, inactive actor, nil principal (500), and backend error paths.

2. **Unexported context key**: Changed `AdminPrincipalKey` to unexported `adminPrincipalKey` in `authz/middleware.go`. `GetPrincipal()` accessor retained as the only read path. Permission denial response now returns generic `"insufficient permissions"` instead of exposing dynamic permission codes. Added nil-principal safety test returning 500.

3. **Bounded transaction context**: Both `RotateLearnerSession` and `RotateAdminSession` now use a dedicated `txCtx` derived from the caller context with a 5s timeout for all operations inside the transaction (BeginTx, QueryRow FOR UPDATE, Exec revoke/insert, Commit). The transaction inherits caller cancellation AND enforces its own 5s deadline. Existing disabled-account and expired-token tests cover rejection paths; FOR UPDATE concurrency verified by real PG17 integration.

4. **Report accuracy**: Previous report falsely stated integration tests were ENVIRONMENT_BLOCKED. Integration tests were independently run and passed twice against disposable PG17 (see Verification Results below). Removed all references to deleted test helper. Distinguished unit tests (no DB) from integration tests (disposable PG17).

5. **Cumulative scope**: The accepted M3 remainder wave spans seven commits after base `a0522664`. Cumulative diff adds `authz/middleware.go`, `authz/middleware_test.go`, `session/rotation_test.go`; modifies `session/store.go`, `session/store_test.go`, `authz/rbac_test.go`; deletes `authn/testing.go` (removed at `621320b0`); and maintains this report. `ORCHESTRATION_STATE.md` updated only after Sol gate acceptance. Unrelated dirty files preserved throughout.

## Artifact List (Cumulative M3 Remainder Wave)

| Artifact | Path | Status |
|---|---|---|
| Session store (rotation) | `apps/api-go/internal/session/store.go` | REPAIRED (bounded txCtx derived from caller, atomic rotation) |
| Session store tests | `apps/api-go/internal/session/store_test.go` | REPAIRED (direct expired/revoked/disabled rotation rejection for learner and admin; concurrent-winner tests for both namespaces) |
| Session rotation tests | `apps/api-go/internal/session/rotation_test.go` | ADDED (atomic rotation integration tests for learner and admin) |
| Test helper (deleted) | `apps/api-go/internal/authn/testing.go` | DELETED at `621320b0` (was untracked production bypass risk) |
| Admin authz middleware | `apps/api-go/internal/authz/middleware.go` | ADDED (composed AdminGuard → RequirePermission/RequireAnyPermission) |
| Admin authz middleware tests | `apps/api-go/internal/authz/middleware_test.go` | ADDED (real guard chain, mock seam, no test helper) |
| Admin RBAC tests | `apps/api-go/internal/authz/rbac_test.go` | REPAIRED (distinct placeholders for varchar/text in seedRoleWithPermission) |
| M3 rotation/authz report | `docs/migrations/go-backend-v2/reports/M3_SESSION_ROTATION_AUTHZ_REPORT.md` | REWRITTEN across seven commits (this file) |

## Architecture Decisions

1. **Atomic rotation via pgx transaction**: Old session revoked and new session inserted in single transaction with `FOR UPDATE` row lock. Prevents concurrent rotation races and ensures old token is invalidated before new token is returned.
2. **Owner-scoped revocation**: Rotation requires matching owner identity (userID or actorID) derived from valid current session. Cross-user/cross-actor rotation is impossible by construction.
3. **Bounded transaction context**: All transaction operations use a 5s `txCtx` derived from the caller context. The transaction inherits caller cancellation AND enforces its own 5s deadline, preventing unbounded blocking on stuck transactions while respecting upstream cancellation.
4. **Mock SessionLookup seam**: `authz/middleware_test.go` defines a local `mockSessionLookup` interface satisfying `authn.SessionLookup`. Enables full guard chain testing without DB or test helpers in production packages.
5. **Generic permission denial**: Denial responses never expose specific permission codes. Prevents information leakage about RBAC policy structure.
6. **Unexported context key**: `adminPrincipalKey` is unexported; only `GetPrincipal()` provides read access. Prevents external packages from fabricating authenticated context.
7. **No schema migration**: Rotation uses existing M2 `auth.session` and `auth.admin_session` tables. No new columns, indexes, or constraints.

## Verification Results

### Go Toolchain (all with GOTOOLCHAIN=go1.23.0)

| Check | Command | Result |
|---|---|---|
| gofmt | `gofmt -w . && test -z "$(gofmt -l .)"` | ✅ CLEAN |
| go vet | `GOTOOLCHAIN=go1.23.0 go vet ./...` | ✅ PASS |
| go test | `GOTOOLCHAIN=go1.23.0 go test ./...` | ✅ PASS (all packages) |
| go test -race | `GOTOOLCHAIN=go1.23.0 go test -race ./...` | ✅ PASS |
| ARM64 build | `GOTOOLCHAIN=go1.23.0 GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -o /tmp/api-go-m3-final ./cmd/api` | ✅ PASS (ELF ARM aarch64 static) |

### PostgreSQL 17 Integration Tests (Production-Like Schema)

**Environment**: Fresh disposable `postgres:17-alpine` container (`m3-prodlike-pg`), database `m3prodlike`. Parent tables created with **production-exact column types** (`authz.admin_role.code VARCHAR(80)`, `authz.admin_role.name TEXT`, `authz.admin_permission.code VARCHAR(120)`, `authz.admin_actor.status VARCHAR(32)`, `profile.user_profile.status VARCHAR(32)`). M2 auth session persistence migration applied. Port 15435.

This verification was added after independent Sol review found that prior disposable DB tests used stub tables where `admin_role.code` and `admin_role.name` had identical types, masking a real `SQLSTATE 42P08` parameter type inference failure in the `seedRoleWithPermission` test harness. The harness was fixed to use distinct placeholders (`$1`, `$2`) for varchar and text columns.

| Run | Package | Duration | Result |
|---|---|---|---|
| 1 | `internal/session` | ~1.0s | ✅ PASS |
| 1 | `internal/authz` | ~0.5s | ✅ PASS |
| 2 | `internal/session` | ~1.0s | ✅ PASS |
| 2 | `internal/authz` | ~0.5s | ✅ PASS |

Command: `TEST_DATABASE_URL=<disposable-pg17-url> GOTOOLCHAIN=go1.23.0 go test ./internal/session ./internal/authz -count=2`

Both runs executed against the same fresh production-like DB instance, proving repeatability with schema-faithful column types. Connection string supplied via environment variable only; no credentials appear in logs, reports, or committed artifacts.

### Unit Test Coverage (No DB Required)

- **session/token**: Token generation, validation, hashing, constant-time comparison, format rejection (empty, short, long, non-hex, uppercase, mixed case)
- **session/store (unit)**: Create rejects past expiry; lookup validates token format before DB call
- **authz/middleware**: Full composed guard chain with mock seam — missing cookie, invalid session, successful identity injection, permission allow/deny/wildcard, inactive actor, nil principal (500), backend error (500), no raw token in logs
- **authz/rbac**: LoadPrincipal with permissions, wildcard, disabled actor, missing actor, HasAnyPermission without wildcard

## Security Negatives Verified

1. **No raw token exposure**: Rotation methods never log or return digest; errors wrap with generic messages. Middleware tests assert captured log output contains no token material.
2. **Owner-scoped rotation**: Cross-user/cross-actor rotation rejected by SQL WHERE clause including owner ID.
3. **Disabled account rejection**: Lookup joins `user_profile`/`admin_actor` with `status='active'` filter; disabled accounts return `ErrSessionNotFound`.
4. **Expired/revoked rejection**: SQL WHERE filters `expires_at > now() AND revoked_at IS NULL`; expired/revoked tokens return `ErrSessionNotFound`.
5. **Bounded parameters**: Transaction timeout prevents unbounded blocking; token validation rejects malformed input before any DB call.
6. **Generic denial messages**: Permission denial returns `"insufficient permissions"` without exposing specific permission codes.
7. **Unexported context key**: External packages cannot fabricate admin identity via context manipulation.
8. **No production test helpers**: Deleted `authn/testing.go`; no exported context fabricators in production packages.

## Rollback

Code-level only. No schema changes. Revert all seven M3 remainder commits after accepted base `a0522664` in reverse chronological order: `3e228d1e`, `7db1e777`, `c45eddbc`, `3c4603d1`, `621320b0`, `02fd4874`, `a2dd34d0`. Existing M2 session tables remain intact. No data migration to reverse. Do not use history rewrite.

## M3 Full Credential Gate Status

**GATED_UNKNOWN_PRODUCTION** — unchanged. Production Keycloak credential format remains unavailable. This wave is independent of credential verification; rotation and authorization middleware operate on first-party opaque sessions only. M3 full acceptance requires production credential metadata confirmation before legacy verifier implementation.

## Limits and Deferred Work

1. **No login/logout endpoints**: Session creation/destruction endpoints deferred to post-gate M3 completion.
2. **No rate limiting**: Login attempt throttling deferred to actual endpoint implementation.
3. **No CSRF token binding**: Cookie-authenticated unsafe methods not yet mounted; Origin/Referer validation from prior M3 infra commit remains sufficient for scaffold.
4. **No idle session expiry**: Only absolute expiry implemented; sliding window deferred pending product decision.
5. **No credential verifier**: Blocked on production Keycloak metadata. Dev defaults confirmed Argon2id v1.3 m=7168 t=5 p=1 len=32; production UNVERIFIED.