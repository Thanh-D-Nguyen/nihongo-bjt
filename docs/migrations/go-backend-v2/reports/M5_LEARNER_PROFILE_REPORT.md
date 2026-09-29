# M5 Learner Profile & Preferences — Implementation Report

## Summary

Implemented GET and PUT `/api/auth/me` endpoints for learner profile management in the Go API backend.

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `apps/api-go/internal/httpserver/handler_profile.go` | Created | GET and PUT handlers for `/api/auth/me` |
| `apps/api-go/internal/httpserver/handler_profile_test.go` | Created | 6 integration tests covering all acceptance criteria |
| `apps/api-go/internal/profile/store.go` | Modified | Added `LearnerFullProfile`, `GetLearnerFullProfile`, `UpdateProfileParams`, `UpdateLearnerProfile` |
| `apps/api-go/internal/httpserver/server.go` | Modified | Wired GET (session-only) and PUT (session+CSRF) routes |

## Endpoints

### GET /api/auth/me
- Session-guarded only (no CSRF)
- Returns flat JSON object with all 13 fields: id, email, displayName, status, themeMode, fontSizePreference, densityPreference, flashcardStyleSlug, coverAssetId, adsPersonalizationOptIn, sharePostcardOptIn, createdAt, updatedAt
- 401 for missing/invalid session

### PUT /api/auth/me
- Session + CSRF guarded
- Accepts partial JSON body with mutable fields only
- Immutable fields (id, email, status, createdAt, updatedAt) silently ignored
- Returns updated full profile (same shape as GET)
- 401 for missing/invalid session

## Tests

6 integration tests in `handler_profile_test.go`:
1. `TestLearnerGetMe_Success` — verifies flat JSON shape with all 13 fields
2. `TestLearnerGetMe_Unauthorized` — no session → 401
3. `TestLearnerUpdateMe_Success` — updates displayName + themeMode
4. `TestLearnerUpdateMe_PartialUpdate` — single field update, others unchanged
5. `TestLearnerUpdateMe_ImmutableFieldsIgnored` — email/status not modified
6. `TestLearnerUpdateMe_Unauthorized` — no session → 401

All tests use `t.Cleanup(DELETE)` for UNIQUE constraint compatibility with `-count=2`.

## Gate Results

| Gate | Result |
|------|--------|
| `go test ./...` | PASS (207 tests, 12 packages) |
| `go test -race ./...` | PASS (207 tests, 12 packages) |
| `go vet ./...` | PASS |
| `gofmt -l .` | PASS (no unformatted files) |
| `GOOS=linux GOARCH=arm64 go build ./...` | PASS |

## Design Decisions

- Replaced the existing `learnerMeHandler` (which returned `{profile, sub}` wrapper) with `learnerGetMeHandler` returning a flat object per M5 spec. The old handler remains in `handler_auth.go` but is no longer routed.
- Used dynamic SQL in `UpdateLearnerProfile` to update only provided fields, avoiding overwriting unset fields with zero values.
- `coverAssetId: ""` (empty string) clears the field to NULL; non-empty string sets it.