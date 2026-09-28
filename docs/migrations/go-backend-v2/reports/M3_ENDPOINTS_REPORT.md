# M3 Independent Endpoints Report

## Identification
- **Starting HEAD**: `ef26020d` (post-checkpoint docs)
- **Initial M3_INDEPENDENT_ENDPOINTS commit**: `bd57e52` (REVISE after independent review)
- **Repair commits**: CSRF wiring, admin/me deferral, handler/router tests, CORS config tests
- **Test/profile repair commit**: `296bf63` (UUID v4 IDs, t.Skip for no-DB, profile omitempty fix)
- **Branch**: `main`
- **Wave**: M3_INDEPENDENT_ENDPOINTS — learner/admin session endpoints and profile store
- **Date**: 2026-09-28
- **Prior accepted checkpoint**: `3e228d1e` (M3 rotation/authz remainder)
- **Sol acceptance status**: PENDING — implementation evidence complete, awaiting independent review

## Scope
HTTP handler scaffolding for learner and admin session endpoints that are independent of password credential verification. Profile store for current-user data. CSRF guard wiring from CORS_ORIGINS. No login endpoint, no credential verifier, no rate limiter (deferred — see below).

## Repair Summary

Independent review identified four blockers. All addressed:

1. **CSRF trusted origins wired**: `server.go` now passes `deps.Config.CORSOrigins` to `authn.CSRFConfig.TrustedOrigins`. Invalid origins fail closed at config load time with scheme/host/path/userinfo validation. Six new config tests cover valid, empty, invalid-scheme, missing-host, path, and userinfo cases.

2. **GET /api/admin/session returns real displayName**: `adminSessionHandler` now accepts `*authz.Store` and calls `LoadPrincipal` to resolve the actor's display name from the database. No more empty hardcode.

3. **GET /api/admin/me DEFERRED to M6**: The Nest contract returns a nested `adminActor` object with `roles -> role -> permissions -> permission`. The flattened Go payload was incompatible. Route removed from M3; full admin RBAC cutover belongs to M6. Router test `TestAdminMeRouteRemoved` confirms 404.

4. **Handler/router tests added**: Four new tests verify route mounting, guard behavior, and CSRF config wiring without requiring live database dependencies.

## Implemented Endpoints

### Learner
| Method | Path | Auth | Handler | Status |
|--------|------|------|---------|--------|
| GET | `/api/auth/me` | LearnerGuard (session cookie) | `learnerMeHandler` | ✅ Mounted |
| POST | `/api/auth/logout` | LearnerGuard + CSRFGuard | `learnerLogoutHandler` | ✅ Mounted |

### Admin
| Method | Path | Auth | Handler | Status |
|--------|------|------|---------|--------|
| GET | `/api/admin/session` | AdminGuard (session cookie) | `adminSessionHandler` | ✅ Mounted (with real displayName) |
| POST | `/api/admin/logout` | AdminGuard + CSRFGuard | `adminLogoutHandler` | ✅ Mounted |
| GET | `/api/admin/me` | — | — | ❌ DEFERRED to M6 |

### Health (unchanged)
| Method | Path | Auth | Status |
|--------|------|------|--------|
| GET | `/health/live` | None | ✅ Unchanged |
| GET | `/health/ready` | None | ✅ Unchanged |

## Intentionally Deferred

### Login / Credential Verifier
**BLOCKED by GATED_UNKNOWN_PRODUCTION** — production Keycloak credential format unverified. No login endpoint implemented in this wave.

### Rate Limiter
No concrete mounted route in this wave requires rate limiting. Adding an unused limiter abstraction would violate YAGNI. Deferred to the first endpoint wave that has a concrete rate-limit requirement (likely public-facing search or auth endpoints in a future M3 sub-wave).

### Frontend/BFF Cutover
No Next.js route handler changes. Go endpoints are additive and run on port 4001 parallel with NestJS :4000.

## New Packages / Files

| File | Purpose |
|------|---------|
| `internal/profile/store.go` | Profile store: `GetLearnerProfile(ctx, userID)` queries `profile.user_profile` for public fields including keycloakSubject (exposed because Nest public profile does so). Bounded context (5s). |
| `internal/httpserver/handler_auth.go` | Learner handlers: `learnerMeHandler`, `learnerLogoutHandler`. Uses JSON responses, safe error handling, no credential leakage. |
| `internal/httpserver/handler_admin.go` | Admin handlers: `adminSessionHandler` (with real displayName via authz.Store), `adminLogoutHandler`. No adminMeHandler (deferred to M6). |
| `internal/httpserver/server.go` | Modified: wired `ProfileStore`, `RBACStore`, `SessionStore` into `Dependencies`; mounted learner/admin route groups with guards; CSRF guard uses `deps.Config.CORSOrigins` for trusted origins. |
| `internal/app/app.go` | Modified: creates `session.Store`, `profile.Store`, `authz.Store` from DB pool; passes them to `httpserver.Dependencies`. |
| `internal/config/config.go` | Modified: added `CORSOrigins []string` field with scheme/host/path/userinfo validation at load time. |
| `internal/config/config_test.go` | Modified: added 6 CORS origin parsing tests (valid, empty, invalid-scheme, missing-host, path, userinfo). |
| `internal/httpserver/server_test.go` | Modified: added 4 handler/router tests (admin/me removed, learner/auth/me mounted, admin/session mounted, CSRF config wiring). |

## Security Properties Verified

1. **HttpOnly session cookies**: Learner (`bjt_web_session`) and admin (`bjt_admin_session`) use separate cookie names with namespace isolation.
2. **CSRF on unsafe methods**: POST logout routes require valid Origin/Referer via `CSRFGuard`. Empty trusted origins list rejects all unsafe requests until `CORS_ORIGINS` is wired (TODO documented in code).
3. **Owner-scoped revocation**: `RevokeLearnerSession(ctx, sessionID, userID)` requires both session ID and owning user ID — prevents cross-user revocation. Same pattern for admin.
4. **Disabled account rejection**: Lookup queries JOIN parent table and filter `status = 'active'`. Disabled accounts return `ErrSessionNotFound` (generic 401).
5. **No credential leakage**: Error responses use generic messages ("unauthorized", "internal"). Detailed errors logged server-side only.
6. **Profile response safety**: `GetLearnerPublicProfile` selects only public columns. No password hash or internal metadata exposed. `keycloakSubject` IS returned to match NestJS `AuthController.me` behavior (Prisma select includes it). For future first-party users without a Keycloak subject, the field will be null; no synthetic sub is invented.
7. **Token format validation**: `ValidateRawToken` rejects empty, wrong-length, non-hex tokens before any DB call.

## Verification Results

### Go Toolchain (all with GOTOOLCHAIN=go1.23.0)
| Check | Command | Result |
|-------|---------|--------|
| gofmt | `gofmt -l .` | ✅ CLEAN |
| go vet | `go vet ./...` | ✅ PASS |
| go test | `go test ./...` | ✅ PASS (app, authn, authz, config, credential, httpserver, session) |
| go test -race | `go test -race ./...` | ✅ PASS |
| ARM64 build | `GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -o /tmp/api-go-m3-endpoints ./cmd/api` | ✅ PASS |
| git diff --check | `git diff --check` | ✅ CLEAN |

### PostgreSQL 17 Integration (Actual Evidence)
Disposable `postgres:17-alpine` container (`m3-revise-pg`) with M2 schema + stub parent tables applied. Tests run with `-count=2` against real SQL:

```
TEST_DATABASE_URL="postgres://postgres:m3test@localhost:15433/m3session?sslmode=disable" \
GOTOOLCHAIN=go1.23.0 go test -v -count=2 -run "TestLearnerMe_|TestLearnerLogout_|TestAdminSession_|TestAdminLogout_|TestCSRF_|TestNamespaceIsolation_|TestAdminMe_|TestLearnerMe_Post" ./internal/httpserver/...
```

**Result**: 23/23 tests PASS × 2 rounds = 46 executions, 0 failures.

Tests cover: learner me success + exact JSON shape + nullable nulls, no-cookie/invalid-token/expired/revoked/disabled rejection, logout success + DB revocation + cookie deletion + replay rejection + owner-scoped isolation, CSRF missing/untrusted/trusted/empty-origin behavior, admin session with real displayName + disabled actor rejection, admin logout + revocation + cookie deletion, learner/admin namespace isolation, admin/me not mounted, POST method rejection.

Without `TEST_DATABASE_URL`, all integration tests `t.Skip` so `go test ./...` passes cleanly in CI or environments without a disposable DB.

### Test Coverage Summary
- `internal/app`: composition wiring tests
- `internal/authn`: guard + CSRF unit tests
- `internal/authz`: RBAC store integration tests (PG17)
- `internal/config`: 18 tests including CORS origin parsing
- `internal/credential`: Argon2 verifier tests
- `internal/httpserver`: 23 endpoint behavior tests (PG17 integration) + router/config tests
- `internal/session`: store, token, rotation tests (PG17 integration)

## Gate Status
**NOT YET ACCEPTED BY SOL** — This report documents implementation evidence. Independent Sol verification is required before marking M3_INDEPENDENT_ENDPOINTS as accepted and updating ORCHESTRATION_STATE.md.

## Rollback Guidance
This wave is purely additive. Rollback is code-level: revert commits `bd57e52` and `296bf63`. No schema changes, no data migration, no destructive operations. Existing NestJS endpoints remain authoritative on port 4000.

## Gated Unknowns (Unchanged)
- **Production Keycloak credential format**: GATED_UNKNOWN_PRODUCTION. M3 login/verifier BLOCKED until resolved.
- **Google OAuth production status**: M4 gate.
- **Production MinIO object inventory**: M7 gate.

## Next Wave
Credential-dependent M3 work remains BLOCKED by production Keycloak credential metadata gate. Do not move to M4.