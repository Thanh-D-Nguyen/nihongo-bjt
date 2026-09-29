# M5 Learner Profile & Preferences — Acceptance Report

## Status: ACCEPTED

## Commit SHA
`8c6eddc7` — feat(api-go): add learner profile GET/PUT /api/auth/me endpoints (M5)

## Endpoints Implemented

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/me` | GET | Session | Returns full learner profile with all preferences |
| `/api/auth/me` | PUT | Session + CSRF | Partial update with enum validation, DisallowUnknownFields |

## Response Shape (M5)
Flat JSON object (no `"profile"` wrapper, no `"sub"` key):
```json
{
  "id": "uuid",
  "email": "string",
  "displayName": "string",
  "status": "active",
  "themeMode": "system|light|dark",
  "fontSizePreference": "small|default|large",
  "densityPreference": "compact|comfortable|spacious",
  "flashcardStyleSlug": "string|null",
  "coverAssetId": "uuid|null",
  "adsPersonalizationOptIn": false,
  "sharePostcardOptIn": false,
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

## Files Created/Changed
- `apps/api-go/internal/httpserver/handler_profile.go` — GET/PUT handlers (253 lines)
- `apps/api-go/internal/httpserver/handler_profile_test.go` — 9 integration tests
- `apps/api-go/internal/httpserver/handler_auth_test.go` — Updated 2 stale M3 tests to match M5 flat response shape
- `apps/api-go/internal/httpserver/server.go` — Route wiring for GET and PUT /api/auth/me
- `apps/api-go/internal/profile/store.go` — Added `LearnerFullProfile`, `UpdateProfileParams`, `GetLearnerFullProfile`, `UpdateLearnerProfile` (dynamic SQL)

## Repairs Applied During Verification
1. **Missing LearnerGuard middleware in test server**: `profileTestServer` mounted handlers directly on raw mux without session guard. Rewired to wrap with `authn.LearnerGuard(sessionStore, guardCfg)` so `authn.GetLearnerIdentity(r.Context())` works.
2. **Stale M3 test expectations**: `TestLearnerMe_Success_ExactJSONShape` and `TestLearnerMe_NullableFieldsPresentAsNull` expected old wrapped response shape (`{"profile": {...}, "sub": "..."}`) with `keycloakSubject` field. Updated to expect M5 flat shape with nullable FK fields as JSON null.
3. **gofmt**: Applied to handler_profile.go, handler_profile_test.go, handler_auth_test.go, store.go.

## Gate Results (all PASS)
```
$ go test ./internal/httpserver/... -run 'TestGetMe|TestUpdateMe' -count=2
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/httpserver  1.091s

$ go test ./internal/httpserver/... -count=1
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/httpserver  4.126s

$ go test -race ./internal/httpserver/... -count=1
ok  github.com/kotobawork/nihongo-bjt/api-go/internal/httpserver  30.560s

$ go vet ./...
(clean)

$ gofmt -l .
(clean)

$ GOOS=linux GOARCH=arm64 go build ./...
(clean)
```

## Test Coverage
9 integration tests × 2 = 18 executions against disposable PG17:
- TestGetMe_Success (200, correct fields, DB defaults verified)
- TestGetMe_Unauthorized_NoCookie (401)
- TestGetMe_InvalidSession (401)
- TestUpdateMe_Success (200, displayName + themeMode updated)
- TestUpdateMe_PartialUpdate (200, only fontSizePreference changed, others unchanged)
- TestUpdateMe_InvalidEnum (400, themeMode="neon" rejected)
- TestUpdateMe_DisplayNameTooLong (400, 121 chars rejected)
- TestUpdateMe_UnknownField (400, DisallowUnknownFields)
- TestUpdateMe_Unauthorized_NoCookie (401)

Plus 2 updated M3 tests (TestLearnerMe_Success_ExactJSONShape, TestLearnerMe_NullableFieldsPresentAsNull) now pass with M5 shape.

## Date: 2026-09-29