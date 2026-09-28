# M3 Partial Session Core Repair Report

## Identification
- **Starting HEAD**: `9eb608746d1fc4e993d28c56b3c229bac1f1c2bb` (initial M3 partial, REVISE after security review)
- **Accepted M3 partial checkpoint**: `0d59a78684e6215694d91e2a67cd2c5853b79ac4`
- **Branch**: `main`
- **Wave**: M3 partial — session persistence and RBAC loader; credential verifier BLOCKED
- **Date**: 2026-09-28
- **Accepted M2 persistence checkpoint**: `9c98bad90628d1ca24f71c3034aa3d4a63bf8851`

## Scope
Security-critical repairs to session store and RBAC integration tests identified in independent review of commit 9eb60874. No login/password endpoints. No credential verifier. No production auth routing. M3 full remains BLOCKED on production Keycloak credential format confirmation.

## Repair Summary

### 1. Disabled Account Status Gating (Security-Critical)
**Finding**: LookupLearnerSession and LookupAdminSession did not check parent account status; disabled accounts retained active tokens.
**Fix**: Both lookup queries now JOIN parent tables (`profile.user_profile` / `authz.admin_actor`) and require `status = 'active'`. Disabled or missing accounts return `ErrSessionNotFound`.
**Files**: `apps/api-go/internal/session/store.go:112-129` (learner), `store.go:142-159` (admin).
**Tests**: `TestLookupLearnerSession_DisabledUser`, `TestLookupAdminSession_DisabledActor` — both create a session, disable the account, then verify Store lookup returns ErrSessionNotFound.

### 2. Expired Session Test Rewrite
**Finding**: Original test used bogus doubly-hashed value and verified SQL COUNT instead of Store behavior.
**Fix**: Test now creates a real session via `CreateLearnerSession`, expires it via direct SQL UPDATE, then verifies `Store.LookupLearnerSession(raw)` returns `ErrSessionNotFound`. Exercises actual Store code path.
**File**: `apps/api-go/internal/session/store_test.go:178-203`.

### 3. Constant-Time Claim Removed
**Finding**: Report incorrectly claimed SQL equality is constant-time. `ConstantTimeDigestEqual` was unused in lookup path.
**Fix**: Removed `ConstantTimeDigestEqual` function from `store.go`. Token digest is a lookup key derived from high-entropy random token; no constant-time claim needed for DB index lookup. Report corrected.
**File**: `apps/api-go/internal/session/store.go` (function deleted).

### 4. Input Validation Before Hashing
**Finding**: Lookup accepted arbitrary rawToken length/content and SHA-256 hashed it; unauthenticated requests could send huge strings.
**Fix**: `ValidateRawToken()` requires exactly 64 lowercase hex characters before any hashing. Returns `ErrInvalidToken` for malformed input without DB call. Lookup normalizes `ErrInvalidToken` to `ErrSessionNotFound` to avoid leaking format details.
**Files**: `apps/api-go/internal/session/token.go:37-51` (validation), `store.go:104-110` (learner normalization), `store.go:134-140` (admin normalization).
**Tests**: `TestValidateRawToken_InvalidLength` (6 subcases), `TestValidateRawToken_InvalidCharacters` (7 subcases), `TestLookupLearnerSession_InvalidTokenFormat` (6 subcases asserting ErrSessionNotFound).

### 5. Safe Creation API
**Finding**: Create methods accepted caller-supplied digest with no guard against raw token storage or past expiry.
**Fix**: `CreateLearnerSession` and `CreateAdminSession` now generate token internally via `GenerateToken()`, persist only SHA-256 digest, validate expiry is future (return `ErrInvalidExpiry`), and return raw token exactly once. Raw token never logged.
**Files**: `store.go:56-75` (learner), `store.go:80-99` (admin).
**Tests**: `TestCreateAndLookupLearnerSession` verifies DB stores digest not raw; `TestCreateLearnerSession_RejectsPastExpiry`; `TestCreateAdminSession_RejectsPastExpiry`.

### 6. Owner-Scoped Revocation
**Finding**: Revoke by sessionID alone allowed cross-user revocation with user-supplied ID.
**Fix**: `RevokeLearnerSession(ctx, sessionID, userID)` and `RevokeAdminSession(ctx, sessionID, actorID)` require owner ID in WHERE clause. `RevokeAll*` preserved for trusted administrative paths.
**Files**: `store.go:163-173` (learner), `store.go:177-187` (admin).
**Tests**: `TestRevokeLearnerSession_OwnerScoped` — attacker cannot revoke victim's session; `TestRevokeAdminSession_OwnerScoped` — same for admin namespace.

### 7. Test Isolation and Repeatability
**Finding**: Fixed IDs and ON CONFLICT DO NOTHING caused state leakage between runs.
**Fix**: All integration tests use `newUUID(t)` generating real UUID v4 via `crypto/rand`. Role/permission codes use `uniqueCode(t, prefix)` for varchar-safe uniqueness. Tests run twice against SAME disposable PostgreSQL 17 database; both passes confirmed.
**Files**: `store_test.go:34-42` (newUUID), `rbac_test.go:32-52` (newUUID + uniqueCode).

### 8. CI Compatibility Restored
**Finding**: `testPool` used `t.Fatal` when TEST_DATABASE_URL unset, breaking default `go test ./...` and CI.
**Fix**: Both `session/store_test.go` and `authz/rbac_test.go` restored to `t.Skip` when TEST_DATABASE_URL is unset. Integration tests are explicitly SKIPPED in unit suite; PASS only when run with TEST_DATABASE_URL pointing at disposable PG17.

## Artifact List
| Artifact | Path | Change |
|---|---|---|
| Session store | `apps/api-go/internal/session/store.go` | REWRITTEN (status joins, input validation, safe creation, owner-scoped revoke, removed ConstantTimeDigestEqual) |
| Session token | `apps/api-go/internal/session/token.go` | UPDATED (ValidateRawToken added) |
| Session store tests | `apps/api-go/internal/session/store_test.go` | REWRITTEN (real UUIDs, t.Skip for CI, disabled/expired/owner-scoped tests) |
| Session token tests | `apps/api-go/internal/session/token_test.go` | UPDATED (validation negative tests) |
| RBAC store | `apps/api-go/internal/authz/rbac.go` | UNCHANGED |
| RBAC tests | `apps/api-go/internal/authz/rbac_test.go` | REWRITTEN (real UUIDs, uniqueCode, t.Skip for CI) |
| M3 report (this file) | `docs/migrations/go-backend-v2/reports/M3_PARTIAL_SESSION_CORE_REPORT.md` | REWRITTEN |
| Orchestration state | `docs/migrations/go-backend-v2/ORCHESTRATION_STATE.md` | UPDATED |

## Verification Results

### Unit Suite (no TEST_DATABASE_URL)
| Check | Command | Result |
|---|---|---|
| go test | `unset TEST_DATABASE_URL && GOTOOLCHAIN=go1.23.0 go test ./...` | ✅ PASS (42 tests, 8 packages; integration SKIPPED) |
| go vet | `GOTOOLCHAIN=go1.23.0 go vet ./...` | ✅ CLEAN |
| go test -race | `GOTOOLCHAIN=go1.23.0 go test -race ./...` | ✅ PASS |
| ARM64 build | `GOTOOLCHAIN=go1.23.0 GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -o /tmp/api-go-m3-verify ./cmd/api` | ✅ PASS (11.7M binary at /tmp, NOT in repo) |
| gofmt | `gofmt -l .` | ✅ CLEAN |

### Integration Suite (disposable PostgreSQL 17)
| Check | Command | Result |
|---|---|---|
| Container | `docker run postgres:17-alpine` on port 15434 | ✅ STARTED |
| Schema | Minimal prerequisite tables (profile, authz, auth schemas) | ✅ APPLIED |
| Independent repeat | `TEST_DATABASE_URL=... GOTOOLCHAIN=go1.23.0 go test ./internal/session ./internal/authz -count=2 -v` against disposable PG17 `m3session` DB | ✅ Both runs PASS, same DB |
| Cleanup | `docker rm -f m3-pg17` | ✅ REMOVED |

### Security Review
| Item | Status |
|---|---|
| Disabled account gating | ✅ FIXED — JOIN + status='active' in both lookups |
| Input validation before hashing | ✅ FIXED — 64 hex char requirement |
| Error normalization | ✅ FIXED — ErrInvalidToken → ErrSessionNotFound in lookups |
| Owner-scoped revocation | ✅ FIXED — owner ID required in WHERE |
| Raw token never persisted | ✅ VERIFIED — test asserts digest ≠ raw |
| No constant-time false claim | ✅ FIXED — function removed, report corrected |
| No secrets in logs/errors | ✅ VERIFIED — existing safe error patterns preserved |

## Pending M3 Criteria (BLOCKED)
1. **Production Keycloak credential format** — HARD GATE. Dev instance confirms Argon2id v1.3 (m=7168, t=5, p=1, len=32) but production is UNVERIFIED. M3 credential verifier implementation BLOCKED until production format confirmed via Admin REST API or DB inspection.
2. **Login/password endpoints** — Not implemented. Requires credential gate resolution first.
3. **CSRF/rate limiting** — Documented as remaining; no speculative scaffolding without unsafe cookie-auth endpoint.
4. **HTTP middleware integration** — Session store is ready; HTTP handler wiring deferred to post-gate M3 completion.

## External Credential Gate Action Required
1. Obtain read access to production Keycloak DB (`keycloak-db` service in GCP compose) or Admin REST API
2. Query `credential` table for `nihongo-bjt` realm users: inspect `credential_data` column metadata (algorithm/parameters ONLY; NEVER extract or log hash/salt values)
3. Compare with dev defaults (Argon2id v1.3, m=7168, t=5, p=1, len=32)
4. If match → gate PASS → Approach B; if differ → adjust parameters accordingly
5. Document findings; do not proceed with verifier until resolved

## Gate Recommendation
**M3_PARTIAL_REPAIR_PASS** — Session core security fixes verified. M3 full remains BLOCKED on credential gate. No production auth traffic routes to Go.
