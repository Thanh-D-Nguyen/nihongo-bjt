# Swagger / OpenAPI alignment

Goal: **documented contract matches running code** for the Nest API.

## Agents

- `.cursor/agents/core/backend.md` (decorators/DTO/route)
- `.cursor/agents/core/docs.md` (ghi chú drift/regenerate trong doc nếu có chỗ chuẩn repo)
- Nếu mô tả auth/error nhạy cảm: rà thêm `.cursor/agents/core/security.md`

## Load

- `.cursor/rules/02-api-swagger.mdc`, `00-project-context.mdc`

## Do

1. Compare controllers/modules you touched with OpenAPI decorators and generated spec (use the repo’s standard generate/serve flow if present).
2. For each mismatch: either update decorators/DTOs or remove stale doc — prefer one P0/P1 class of issue per pass.
3. Confirm auth and error behavior are described at the level the project already uses elsewhere.

## Output

List of routes checked, mismatches fixed vs deferred, how to regenerate OpenAPI locally, residual drift if any.
