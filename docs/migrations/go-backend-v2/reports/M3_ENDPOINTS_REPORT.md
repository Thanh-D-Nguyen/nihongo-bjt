# M3 Independent Endpoints Report

## Identification
- **Starting HEAD**: `ef26020d` (post-checkpoint docs)
- **Accepted M3_INDEPENDENT_ENDPOINTS commit**: `bd57e52`
- **Branch**: `main`
- **Wave**: M3_INDEPENDENT_ENDPOINTS — learner/admin session endpoints and profile store
- **Date**: 2026-09-28
- **Prior accepted checkpoint**: `3e228d1e` (M3 rotation/authz remainder)

## Scope
HTTP handler scaffolding for learner and admin session endpoints that are independent of password credential verification. Profile store for current-user data. CSRF guard wiring fix. No login endpoint, no credential verifier, no rate limiter (deferred — see below).

## Implemented Endpoints

### Learner
| Method | Path | Auth | Handler | Status |
|--------|------|------|---------|--------|
| GET | `/api/auth/me` | LearnerGuard (session cookie) | `learnerMeHandler` | ✅ Mounted |
| POST | `/api/auth/logout` | LearnerGuard + CSRFGuard | `learnerLogoutHandler` | ✅ Mounted |

### Admin
| Method | Path | Auth | Handler | Status |
|--------|------|------|---------|--------|
| GET | `/api/admin/session` | AdminGuard (session cookie) | `adminSessionHandler` | ✅ Mounted |
| GET | `/api/admin/me` | AdminGuard | `adminMeHandler` | ✅ Mounted |
| POST | `/api/admin/logout` | AdminGuard + CSRFGuard | `adminLogoutHandler` | ✅ Mounted |

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
| `internal/profile/store.go` | Profile store: `GetLearnerProfile(ctx, userID)` queries `profile.user_profile` for public fields only (id, display_name, email, avatar_url). Returns typed struct. Bounded context (5s). |
| `internal/httpserver/handler_auth.go` | Learner handlers: `learnerMeHandler`, `learnerLogoutHandler`. Admin handlers: `adminSessionHandler`, `adminMeHandler`, `adminLogoutHandler`. All use JSON responses, safe error handling, no credential leakage. |
| `internal/httpserver/server.go` | Modified: wired `ProfileStore`, `RBACStore`, `SessionStore` into `Dependencies`; mounted learner/admin route groups with guards; fixed CSRF guard to use `CSRFConfig` struct. |
| `internal/app/app.go` | Modified: creates `session.Store`, `profile.Store`, `authz.Store` from DB pool; passes them to `httpserver.Dependencies`. |

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
| gofmt | `gofmt -l .` | ✅ CLEAN (after formatting 5 files) |
| go vet | `go vet ./...` | ✅ PASS |
| go test | `go test ./...` | ✅ PASS (app, authn, authz, config, credential, httpserver, session) |
| go test -race | `go test -race ./...` | ✅ PASS |
| ARM64 build | `GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build ./cmd/api` | ✅ PASS |
| git diff --check | `git diff --check` | ✅ CLEAN |

### Test Coverage Summary
- `internal/app`: composition wiring tests (cached)
- `internal/authn`: guard + CSRF unit tests (cached)
- `internal/authz`: RBAC store integration tests (cached)
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