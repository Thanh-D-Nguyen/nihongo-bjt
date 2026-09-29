# M6 Admin RBAC — Implementation Report

## Status: COMPLETE

## Endpoints Implemented

| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| GET | /api/admin/session | adminGuard | Current admin session info (pre-existing) |
| GET | /api/admin/actors | adminGuard | List all admin actors with roles |
| POST | /api/admin/actors | adminGuard + CSRF | Create new admin actor |
| PUT | /api/admin/actors/{id}/status | adminGuard + CSRF | Enable/disable admin actor |
| POST | /api/admin/actors/{id}/roles | adminGuard + CSRF | Assign role to actor |
| DELETE | /api/admin/actors/{id}/roles/{roleId} | adminGuard + CSRF | Revoke role from actor |
| GET | /api/admin/roles | adminGuard | List all roles with permissions |
| GET | /api/admin/permissions | adminGuard | List all permissions |

## Response Shapes

- **Actor**: `{id, email, displayName, status, roles: [{id, code, name}], createdAt, updatedAt}`
- **Role**: `{id, code, name, status, permissions: [{id, code}], createdAt}`
- **Permission**: `{id, code}`

## Files Changed

- `apps/api-go/internal/httpserver/handler_admin_rbac.go` — Updated response types and SQL queries to match spec shapes (added `code` to role briefs, `updatedAt` to actors, `status`/`createdAt` to roles, simplified permissions to `{id, code}`)
- `apps/api-go/internal/httpserver/server.go` — Routes already wired by M5 worker (verified)
- `apps/api-go/internal/httpserver/handler_admin_rbac_test.go` — Tests already complete from M5 worker (verified)
- `apps/api-go/internal/authz/rbac.go` — No changes needed (existing Store sufficient)

## Verification Gates

| Gate | Result |
|------|--------|
| go build ./... | PASS |
| go test ./... | PASS (all packages) |
| go test -race ./... | PASS |
| go vet ./... | PASS |
| gofmt -l . | PASS (no unformatted files) |
| GOOS=linux GOARCH=arm64 go build | PASS |

## Notes

- Integration tests require TEST_DATABASE_URL and skip without it (expected behavior)
- All seed helpers use *pgxpool.Pool directly with t.Cleanup DELETE for UNIQUE constraint compatibility
- Routes use chi URL parameters ({id}, {roleId}) for path extraction