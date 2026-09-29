# M4 Account Lifecycle — Acceptance Report

## Status: ACCEPTED

## Commit SHA
`b60a6e0a` — feat(api-go): add account lifecycle endpoints (register, forgot/reset/change-password, disable, delete)

## Endpoints Implemented
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/register` | POST | Public | Email/password/displayName registration with Argon2id credential |
| `/api/auth/forgot-password` | POST | Public | Single-use reset token generation, anti-enumeration (always 200) |
| `/api/auth/reset-password` | POST | Public | Token validation, password update, session revocation |
| `/api/auth/change-password` | POST | Session | Current password verification, update, session revocation |
| `/api/auth/disable` | POST | Session | Set status='disabled', revoke all sessions |
| `/api/auth/delete` | POST | Session | Hard delete user with CASCADE |

## Files Created/Changed
- `apps/api-go/internal/httpserver/handler_lifecycle.go` — All 6 endpoint handlers + helpers
- `apps/api-go/internal/httpserver/handler_lifecycle_test.go` — 12 integration tests
- `apps/api-go/internal/httpserver/server.go` — Route wiring + DBPool field added to Dependencies
- `apps/api-go/internal/app/app.go` — DBPool wired into httpserver.Dependencies
- `apps/api-go/internal/credential/store.go` — Added `SetLearnerCredentialTx` for transactional registration
- `apps/api-go/internal/postgres/migrations/002_account_lifecycle.sql` — `auth.password_reset_token` table

## Repairs Applied During Verification
1. **DB type mismatch**: Lifecycle handlers initially used `postgres.Pinger` but needed `*pgxpool.Pool` for `BeginTx`. Added `DBPool *pgxpool.Pool` field to `Dependencies` struct and wired it in `app.go`.
2. **Unused import**: Removed stale `profile` import from handler_lifecycle.go.
3. **RateLimiter config**: Test used positional args; fixed to use `RateLimiterConfig` struct with `EvictEvery` field.
4. **Unterminated string literal**: Test file was truncated at line 140; rewrote completely.
5. **FK violation in registration**: `SetLearnerCredential` ran outside the profile creation transaction. Added `SetLearnerCredentialTx` that accepts `pgx.Tx`.
6. **Token hash mismatch**: Reset handler hex-decoded the token before hashing; fixed to hash raw token string directly.
7. **JSON field name mismatch**: Test sent `"newPassword"` but handler expected `"password"` for reset-password endpoint.

## Gate Results (all PASS)
```
$ go test ./internal/httpserver/... -run 'TestRegister|TestForgotPassword|TestResetPassword|TestChangePassword|TestDisableAccount|TestDeleteAccount' -count=2
ok  	github.com/kotobawork/nihongo-bjt/api-go/internal/httpserver	2.715s

$ go test ./internal/httpserver/... -count=1
ok  	github.com/kotobawork/nihongo-bjt/api-go/internal/httpserver	3.872s

$ go test -race ./internal/httpserver/... -count=1
ok  	github.com/kotobawork/nihongo-bjt/api-go/internal/httpserver	30.110s

$ go vet ./...
(clean)

$ gofmt -l .
(clean)

$ GOOS=linux GOARCH=arm64 go build ./...
(clean)
```

## Google OAuth Decision
RETIRE — documented in `M4_GOOGLE_OAUTH_DECISION.md`. Feature-gated identity-linking only, no password credentials, low usage for personal app.

## Date: 2026-09-29