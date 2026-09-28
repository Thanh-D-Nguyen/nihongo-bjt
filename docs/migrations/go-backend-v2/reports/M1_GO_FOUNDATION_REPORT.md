# M1 Go Foundation Report

## Identification
- **Starting HEAD**: `025124c3336f819b9ac0d30ba80c1da752800f92`
- **Final HEAD**: (pending commit)
- **Branch**: `main`
- **Wave**: M1 — Go foundation + deployment foundations
- **Date**: 2026-09-28
- **Accepted H0 checkpoint**: `17c3e606b0a333103445ed054582b726bff52781`

## Scope
Go module scaffold, config loading, health endpoints, structured logging, PostgreSQL pool, Redis client, graceful shutdown, ARM64 build verification, CI integration, Dockerfile, and deployment strategy documentation. No business logic, auth, media, or Caddy cutover.

## Artifact List

| Artifact | Path | Status |
|---|---|---|
| Go module | `apps/api-go/go.mod` | CREATED |
| Go sum | `apps/api-go/go.sum` | CREATED |
| Main entrypoint | `apps/api-go/cmd/api/main.go` | CREATED |
| Config package | `apps/api-go/internal/config/config.go` | CREATED |
| Config tests | `apps/api-go/internal/config/config_test.go` | CREATED |
| App composition | `apps/api-go/internal/app/app.go` | CREATED |
| HTTP server + health | `apps/api-go/internal/httpserver/server.go` | CREATED |
| HTTP server tests | `apps/api-go/internal/httpserver/server_test.go` | CREATED |
| PostgreSQL pool | `apps/api-go/internal/postgres/pool.go` | CREATED |
| Redis client | `apps/api-go/internal/redisx/client.go` | CREATED |
| Dockerfile | `apps/api-go/Dockerfile` | CREATED |
| CI workflow update | `.github/workflows/ci.yml` | UPDATED |
| Deployment strategy | `docs/migrations/go-backend-v2/docs/19_m1_deployment_strategy.md` | CREATED |
| M1 report (this file) | `docs/migrations/go-backend-v2/reports/M1_GO_FOUNDATION_REPORT.md` | CREATED |

## Architecture Decisions Applied

1. **net/http + chi** — Router is `chi/v5` with standard middleware (RequestID, RealIP, Recoverer, Timeout).
2. **pgx/v5** — Connection pool via `pgxpool.NewWithConfig`; bounded acquire timeout; ping with 3s context.
3. **go-redis/v9** — Optional client; nil-safe when REDIS_URL is empty; readiness skips check if unconfigured.
4. **slog JSON** — Structured JSON handler on stdout; level parsed from LOG_LEVEL env; no secrets logged (MaskedDatabaseURL redacts passwords).
5. **Explicit composition** — `app.New()` wires config → logger → pgx pool → redis client → router → server. No global singletons.
6. **Graceful shutdown** — SIGTERM/SIGINT via `signal.NotifyContext`; bounded ShutdownTimeout; reverse-order resource cleanup.
7. **Port 4001** — Non-conflicting with NestJS :4000 during parallel migration.
8. **Multi-stage Dockerfile** — golang:1.23-alpine builder, alpine:3.20 runtime, non-root appuser, CGO_ENABLED=0 static binary.
9. **ARM64 target** — TARGETOS/TARGETARCH args default to linux/arm64; cross-compile verified.

## Verification Results

### Go Toolchain

| Check | Command | Result |
|---|---|---|
| gofmt | `gofmt -w . && test -z "$(gofmt -l .)"` | ✅ CLEAN |
| go vet | `go vet ./...` | ✅ PASS |
| go test | `go test ./...` | ✅ PASS (config: 4/4, httpserver: 4/4) |
| go test -race | `go test -race ./...` | ✅ PASS |
| ARM64 build | `GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build ./cmd/api` | ✅ PASS |

### Docker ARM64 Build

| Check | Command | Result |
|---|---|---|
| Docker buildx | `docker buildx build --platform linux/arm64 -t kotobawork/api-go:m1-test --load .` | ⚠️ ENVIRONMENT_BLOCKED |

**Exact error**: `ERROR: failed to connect to the docker API at unix:///Users/thanhnguyen/.docker/run/docker.sock; check if the path is correct and if the daemon is running: dial unix /Users/thanhnguyen/.docker/run/docker.sock: connect: no such file or directory`

**Classification**: ENVIRONMENT_BLOCKED — Docker daemon not running locally. The Dockerfile is structurally correct (multi-stage, architecture-neutral bases, non-root user, CGO_ENABLED=0). ARM64 cross-compilation of the Go binary itself passed. Docker build verification requires a running Docker daemon and will be validated in CI or on an OCI/GCP host with Docker available.

### Health Endpoint Behavior

| Endpoint | Dependency | Expected Behavior | Test Evidence |
|---|---|---|---|
| GET /health/live | None | Always 200 `{"status":"ok"}` | `TestLiveHandler`: 200, status=ok ✅ |
| GET /health/ready | PostgreSQL (required), Redis (optional) | 200 if all configured deps healthy; 503 if any fail | `TestReadyHandler_NoDB`: handles nil DB gracefully ✅ |

**Readiness security**: Error details are logged server-side only (`deps.Logger.Error`). HTTP response contains only `"fail"` / `"ok"` / `"not_configured"` strings — no internal error messages leaked.

### Config Validation

| Env Var | Required | Default | Validation |
|---|---|---|---|
| DATABASE_URL | YES | — | Load() returns error if empty |
| API_GO_PORT | No | "4001" | String passthrough |
| REDIS_URL | No | "" | Empty = skip Redis in readiness |
| LOG_LEVEL | No | "info" | Parsed to slog.Level; invalid → info |
| SERVER_READ_TIMEOUT | No | 15s | time.ParseDuration; invalid → fallback |
| SERVER_WRITE_TIMEOUT | No | 15s | time.ParseDuration; invalid → fallback |
| SERVER_IDLE_TIMEOUT | No | 60s | time.ParseDuration; invalid → fallback |
| SHUTDOWN_TIMEOUT | No | 10s | time.ParseDuration; invalid → fallback |
| DB_POOL_MAX_CONNS | No | 20 | int32 parse; invalid → fallback |
| DB_POOL_MIN_CONNS | No | 2 | int32 parse; invalid → fallback |
| DB_CONN_ACQUIRE_TIMEOUT | No | 5s | time.ParseDuration; invalid → fallback |

**Secret safety**: `MaskedDatabaseURL()` redacts password portion of connection strings. Verified by unit tests covering URLs with/without credentials.

## CI Integration

Added `go-checks` job to `.github/workflows/ci.yml`:
- Runs on ubuntu-latest alongside existing JS pipeline
- Working directory: `apps/api-go`
- Steps: checkout, setup-go 1.23, mod download, gofmt check, go vet, go test, go test -race, ARM64 cross-compile
- Does not modify or break existing JS jobs

## Deployment Strategy

See `docs/migrations/go-backend-v2/docs/19_m1_deployment_strategy.md` for full details.

Summary:
- Go API runs on port 4001 (parallel with NestJS :4000)
- No Caddy cutover in M1; eventual strategy documented
- ARM64 image built via multi-stage Dockerfile with buildx
- Health semantics: /health/live (process), /health/ready (dependencies)
- Container runtime: non-root user, read-only filesystem compatible

## Gated Unknowns Carried Forward

| Item | Status | Blocking Wave |
|---|---|---|
| Keycloak credential format | GATED_UNKNOWN | M2 |
| Google OAuth production status | GATED_UNKNOWN_PRODUCTION | M4 |
| MinIO object inventory | GATED_UNKNOWN | M7 |
| Docker ARM64 build (local) | ENVIRONMENT_BLOCKED | M1 (CI/host verification pending) |

## Rollback State

No migration applied. Existing NestJS/Keycloak/MinIO/GCP paths fully retained. Go service is purely additive. Rollback = do nothing.

## Gate Recommendation

**M1_PASS_WITH_ENVIRONMENT_BLOCKED_DOCKER**

Rationale:
- ✅ All Go source files created and verified (gofmt, vet, test, race, ARM64 build)
- ✅ Config validation with required env enforcement and secret masking
- ✅ Health endpoints with bounded timeouts and safe error handling
- ✅ Graceful shutdown with signal handling and resource cleanup
- ✅ Multi-stage Dockerfile with non-root user and ARM64 support
- ✅ CI workflow updated with parallel Go validation job
- ✅ Deployment strategy documented
- ⚠️ Docker ARM64 build ENVIRONMENT_BLOCKED (daemon unavailable locally); Dockerfile is structurally correct and ARM64 Go binary compiles successfully; Docker build verification deferred to CI or host with Docker daemon
- ✅ No business logic, auth, media, or Caddy changes
- ✅ Unrelated dirty files preserved exactly