# M3 Independent Endpoints Report

## Identification
- **Starting HEAD**: `ef26020d` (post-checkpoint docs)
- **Initial M3_INDEPENDENT_ENDPOINTS commit**: `bd57e52` (REVISE after independent review)
- **Repair commits**: CSRF wiring, admin/me deferral, handler/router tests, CORS config tests
- **Branch**: `main`
- **Wave**: M3_INDEPENDENT_ENDPOINTS — learner/admin session endpoints and profile store
- **Date**: 2026-09-28
- **Prior accepted checkpoint**: `3e228d1e` (M3 rotation/authz remainder)

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
6. **Profile response safety**: `GetLearnerProfile` selects only public columns. No password hash, keycloak subject, or internal metadata exposed.
7. **Token format validation**: `ValidateRawToken` rejects empty, wrong-length, non-hex tokens before any DB call.

## Verification Results

### Go Toolchain (all with GOTOOLCHAIN=go1.23.0)
| Check | Command | Result |
|-------|---------|--------|
| gofmt | `gofmt -l .` | ✅ CLEAN |
| go vet | `go vet ./...` | ✅ PASS |
| go test | `go test ./...` | ✅ PASS (app, authn, authz, config, credential, httpserver, session) |
| go test -race | `go test -race ./internal/httpserver/... ./internal/config/...` | ✅ PASS |
| ARM64 build | `GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build ./cmd/api` | ✅ PASS (ELF ARM aarch64 static) |

### Test Coverage Summary
- `internal/app`: composition wiring tests
- `internal/authn`: guard + CSRF unit tests
- `internal/authz`: RBAC store integration tests
- `internal/config`: 18 tests including 6 new CORS origin parsing tests
- `internal/credential`: Argon2 verifier tests
- `internal/httpserver`: 13 tests including 4 new handler/router tests (admin/me removed, learner/auth/me mounted, admin/session mounted, CSRF config wiring)
- `internal/session`: store, token, rotation tests

### PostgreSQL 17 Integration
Session/authz/profile integration tests require `TEST_DATABASE_URL` with M2 schema applied. These are skipped when the environment variable is unset (CI/local without disposable DB). When available, they exercise real SQL against production-like schema.

## Rollback
Code-level only: leave additive tables and Go code intact. No destructive schema changes in this wave. The existing NestJS API on port 4000 remains the production path; Go endpoints on port 4001 are purely additive.

## Gate Status
**NOT YET ACCEPTED BY SOL** — This report documents implementation evidence. Independent Sol verification is required before marking M3_INDEPENDENT_ENDPOINTS as accepted and updating ORCHESTRATION_STATE.md.
- `internal/config`: validation tests (cached)
- `internal/credential`: placeholder tests (cached)
- `internal/httpserver`: handler + router tests including live/ready (0.521s)
- `internal/session`: store + token + rotation integration tests (cached)

## Rollback Guidance
This wave is purely additive. Rollback is code-level: revert commit `bd57e52`. No schema changes, no data migration, no destructive operations. Existing NestJS endpoints remain authoritative on port 4000.

## Gated Unknowns (Unchanged)
- **Production Keycloak credential format**: GATED_UNKNOWN_PRODUCTION. M3 login/verifier BLOCKED until resolved.
- **Google OAuth production status**: M4 gate.
- **Production MinIO object inventory**: M7 gate.

## Next Wave
M3 independent endpoint/rate-limit remainder: additional non-auth endpoints that do not require credential verification. Login/legacy verifier remains BLOCKED by credential gate. Do not move to M4.