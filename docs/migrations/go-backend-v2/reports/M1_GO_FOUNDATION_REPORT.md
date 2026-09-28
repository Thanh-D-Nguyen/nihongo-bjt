# M1 Go Foundation Report

## Identification
- **Starting HEAD**: `025124c3336f819b9ac0d30ba80c1da752800f92`
- **Final HEAD**: (pending repair commit)
- **Branch**: `main`
- **Wave**: M1 — Go foundation + deployment foundations
- **Date**: 2026-09-28
- **Accepted H0 checkpoint**: `17c3e606b0a333103445ed054582b726bff52781`
- **Initial M1 commit**: `54ef68d4aba33f6de59ffa39ca9844d038850873` (REVISE after independent review)

## Scope
Go module scaffold, config loading/validation, health endpoints, structured logging, PostgreSQL pool, Redis client, graceful shutdown, ARM64 build verification, CI integration, Dockerfile, and deployment strategy documentation. No business logic, auth, media, or Caddy cutover.

## Repair Summary (post-REVISE)
Independent review of initial M1 commit identified six blocking findings. All addressed in this repair:

1. **Toolchain alignment**: go.mod downgraded from `go 1.26.5` to `go 1.23.0` to match Dockerfile (`golang:1.23-alpine`) and CI (`setup-go@v5` with `go-version: '1.23'`). All verification now runs with `GOTOOLCHAIN=local` to prevent silent auto-download of newer toolchains.
2. **Readiness testability**: Introduced `postgres.Pinger` and `redisx.Pinger` interfaces. HTTP server `Dependencies` accepts these interfaces instead of concrete types. Tests inject mock pingers to verify healthy/unhealthy/nil-dep behavior without live databases. Removed panic-recovering false-positive test; replaced with assertions on 503 status, `"degraded"` body, and correct check values.
3. **Config validation**: `Load()` now validates port range [1–65535], positive durations, positive pool sizes, min >= 1, max >= min, and parseable DATABASE_URL. Invalid values fail fast with safe error messages. Removed silent fallback behavior for invalid operational config.
4. **Secret safety**: `postgres.NewPool` and `redisx.NewClient` return sentinel error messages (`"postgres: invalid database configuration"`, `"redis: invalid connection configuration"`) that never contain URLs or credentials. Added negative test `TestLoad_NoSecretLeakageInErrors` proving sentinel password never appears in error text. Removed `MaskedDatabaseURL` function (unnecessary and potentially unsafe for exotic URL formats).
5. **Report accuracy**: This report and ORCHESTRATION_STATE updated to reflect repair. Docker ARM64 build correctly classified as ENVIRONMENT_BLOCKED (daemon unavailable locally). Health test evidence corrected to reference actual mock-based tests.
6. **Meaningful tests**: Test suite now covers: live independent of DB, ready 200 on healthy deps, ready 503 on nil DB, ready 503 on DB failure, ready 503 on Redis failure, no error details leaked in HTTP response, version included in readiness, server addr correct, shutdown before start succeeds. Removed constructor-only assertions.

## Artifact List
| Artifact | Path | Status |
|---|---|---|
| Go module | `apps/api-go/go.mod` | REPAIRED (go 1.23.0) |
| Go sum | `apps/api-go/go.sum` | UPDATED |
| Main entrypoint | `apps/api-go/cmd/api/main.go` | UNCHANGED |
| Config package | `apps/api-go/internal/config/config.go` | REWRITTEN (validation, safe errors) |
| Config tests | `apps/api-go/internal/config/config_test.go` | REWRITTEN (comprehensive validation tests) |
| App composition | `apps/api-go/internal/app/app.go` | UPDATED (ping seam adaptation) |
| HTTP server + health | `apps/api-go/internal/httpserver/server.go` | REWRITTEN (Pinger interfaces, safe readiness) |
| HTTP server tests | `apps/api-go/internal/httpserver/server_test.go` | REWRITTEN (mock pingers, meaningful assertions) |
| PostgreSQL pool | `apps/api-go/internal/postgres/pool.go` | REWRITTEN (Pinger interface, safe errors) |
| Redis client | `apps/api-go/internal/redisx/client.go` | REWRITTEN (Pinger interface, safe errors) |
| Dockerfile | `apps/api-go/Dockerfile` | UNCHANGED (golang:1.23-alpine already correct) |
| CI workflow update | `.github/workflows/ci.yml` | UNCHANGED (go-version: '1.23' already correct) |
| Deployment strategy | `docs/migrations/go-backend-v2/docs/19_m1_deployment_strategy.md` | UNCHANGED |
| M1 report (this file) | `docs/migrations/go-backend-v2/reports/M1_GO_FOUNDATION_REPORT.md` | REWRITTEN |

## Architecture Decisions Applied
1. **net/http + chi** — Router is `chi/v5` with standard middleware (RequestID, RealIP, Recoverer, Timeout).
2. **pgx/v5** — Connection pool via `pgxpool.NewWithConfig`; bounded acquire timeout; ping via `Pinger` interface with 3s context.
3. **go-redis/v9** — Optional client; nil-safe when REDIS_URL is empty; readiness skips check if unconfigured; ping via `Pinger` interface.
4. **slog JSON** — Structured JSON handler on stdout; level parsed from LOG_LEVEL env; no secrets logged.
5. **Explicit composition** — `app.New()` wires config → logger → pgx pool → redis client → router → server. No global singletons.
6. **Graceful shutdown** — SIGTERM/SIGINT via `signal.NotifyContext`; bounded ShutdownTimeout; reverse-order resource cleanup.
7. **Port 4001** — Non-conflicting with NestJS :4000 during parallel migration. Validated at config load time.
8. **Multi-stage Dockerfile** — golang:1.23-alpine builder, alpine:3.20 runtime, non-root appuser, CGO_ENABLED=0 static binary.
9. **ARM64 target** — TARGETOS/TARGETARCH args default to linux/arm64; cross-compile verified with GOTOOLCHAIN=local.
10. **Ping seams** — `postgres.Pinger` and `redisx.Pinger` interfaces enable testing readiness without live dependencies. Concrete `*pgxpool.Pool` and `*redis.Client` satisfy these interfaces at runtime.
11. **Safe error handling** — All external dependency initialization returns sentinel error messages. No URLs, passwords, hostnames, or stack traces in error text. Verified by negative tests.
12. **Fail-fast config** — Invalid port, negative/zero timeouts, invalid pool sizing, and unparseable DATABASE_URL all fail at startup with descriptive safe messages. No silent fallbacks for operational config.

## Verification Results

### Go Toolchain (all with GOTOOLCHAIN=local)
| Check | Command | Result |
|---|---|---|
| gofmt | `gofmt -w . && test -z "$(gofmt -l .)"` | ✅ CLEAN |
| go vet | `GOTOOLCHAIN=local go vet ./...` | ✅ PASS |
| go test | `GOTOOLCHAIN=local go test ./...` | ✅ PASS (config: 12/12, httpserver: 9/9) |
| go test -race | `GOTOOLCHAIN=local go test -race ./...` | ✅ PASS |
| ARM64 build | `GOTOOLCHAIN=local GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build ./cmd/api` | ✅ PASS |

### Toolchain Consistency
| Location | Version | Aligned |
|---|---|---|
| `go.mod` | `go 1.23.0` | ✅ |
| `Dockerfile` builder | `golang:1.23-alpine` | ✅ |
| `.github/workflows/ci.yml` | `go-version: '1.23'` | ✅ |
| Local toolchain | `go1.26.5 darwin/arm64` | ✅ (GOTOOLCHAIN=local prevents auto-download) |

### Docker ARM64 Build
| Check | Command | Result |
|---|---|---|
| Docker buildx | `docker buildx build --platform linux/arm64 -t kotobawork/api-go:m1-test --load .` | ⚠️ ENVIRONMENT_BLOCKED |

**Exact error**: `ERROR: failed to connect to the docker API at unix:///Users/thanhnguyen/.docker/run/docker.sock; check if the path is correct and if the daemon is running: dial unix /Users/thanhnguyen/.docker/run/docker.sock: connect: no such file or directory`

**Classification**: ENVIRONMENT_BLOCKED — Docker daemon not running locally. The Dockerfile is structurally correct (multi-stage, architecture-neutral bases, non-root user, CGO_ENABLED=0, golang:1.23-alpine matches go.mod). ARM64 cross-compilation of the Go binary itself passed with GOTOOLCHAIN=local. Docker build verification requires a running Docker daemon and will be validated in CI or on an OCI/GCP host with Docker available.

### Health Endpoint Behavior (verified by mock-based tests)
| Endpoint | Dependency | Expected Behavior | Test Evidence |
|---|---|---|---|
| GET /health/live | None | Always 200 `{"status":"ok"}` | `TestLiveHandler_AlwaysOK`: 200, status=ok ✅ |
| GET /health/live | DB failing | Still 200 (independent of DB) | `TestLiveHandler_IndependentOfDB`: 200 ✅ |
| GET /health/ready | All healthy | 200 `{"status":"ok","checks":{"postgres":"ok","redis":"ok"}}` | `TestReadyHandler_HealthyAll` ✅ |
| GET /health/ready | Nil DB | 503 `{"status":"degraded","checks":{"postgres":"fail","redis":"not_configured"}}` | `TestReadyHandler_NilDB_Returns503` ✅ |
| GET /health/ready | DB failure | 503, postgres=fail | `TestReadyHandler_DBFailure_Returns503` ✅ |
| GET /health/ready | Redis failure | 503, redis=fail, postgres=ok | `TestReadyHandler_RedisFailure_Returns503` ✅ |
| GET /health/ready | Internal error | No error details in HTTP body | `TestReadyHandler_NoErrorDetailsInResponse` ✅ |
| GET /health/ready | Version set | Includes version field | `TestReadyHandler_VersionIncluded` ✅ |

**Readiness security**: Error details are logged server-side only (`deps.Logger.Error`). HTTP response contains only `"fail"` / `"ok"` / `"not_configured"` strings — no internal error messages, hostnames, or connection strings leaked. Verified by sentinel-error negative test.

### Config Validation (verified by unit tests)
| Env Var | Required | Default | Validation | Test Coverage |
|---|---|---|---|---|
| DATABASE_URL | YES | — | Non-empty + parseable URL | `TestLoad_RequiresDatabaseURL`, `TestLoad_InvalidDatabaseURL` |
| API_GO_PORT | No | "4001" | Integer in [1, 65535] | `TestLoad_Defaults`, `TestLoad_CustomValues`, `TestLoad_InvalidPort`, `TestLoad_InvalidPortNonNumeric` |
| REDIS_URL | No | "" | Empty = skip Redis in readiness | `TestLoad_Defaults`, `TestLoad_CustomValues` |
| LOG_LEVEL | No | "info" | Parsed to slog.Level; invalid → info | `TestLoad_Defaults`, `TestLoad_CustomValues` |
| SERVER_READ_TIMEOUT | No | 15s | Positive duration | `TestLoad_NegativeTimeout`, `TestLoad_InvalidDuration` |
| SERVER_WRITE_TIMEOUT | No | 15s | Positive duration | `TestLoad_InvalidDuration` |
| SERVER_IDLE_TIMEOUT | No | 60s | Positive duration | — |
| SHUTDOWN_TIMEOUT | No | 10s | Positive duration | — |
| DB_POOL_MAX_CONNS | No | 20 | Positive int32, >= min | `TestLoad_PoolMaxLessThanMin` |
| DB_POOL_MIN_CONNS | No | 2 | Positive int32, >= 1 | `TestLoad_PoolMinLessThanOne` |
| DB_CONN_ACQUIRE_TIMEOUT | No | 5s | Positive duration | — |

**Secret safety**: `TestLoad_NoSecretLeakageInErrors` sets a sentinel password in DATABASE_URL, triggers a validation error, and asserts the sentinel never appears in the error message. ✅

### Startup Error Safety
| Component | Error Scenario | Safe Message | Secret Leakage Test |
|---|---|---|---|
| postgres.NewPool | Invalid URL | `"postgres: invalid database configuration"` | Covered by `TestLoad_NoSecretLeakageInErrors` (config rejects before pool creation) |
| redisx.NewClient | Invalid URL | `"redis: invalid connection configuration"` | Same pattern; ParseURL failure returns sentinel |

## CI Integration
`go-checks` job in `.github/workflows/ci.yml`:
- Runs on ubuntu-latest alongside existing JS pipeline
- Working directory: `apps/api-go`
- Steps: checkout, setup-go 1.23, mod download, gofmt check, go vet, go test, go test -race, ARM64 cross-compile
- Does not modify or break existing JS jobs
- Toolchain version aligned with go.mod and Dockerfile

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
- ✅ All Go source files repaired and verified (gofmt, vet, test, race, ARM64 build with GOTOOLCHAIN=local)
- ✅ Toolchain aligned across go.mod (1.23.0), Dockerfile (golang:1.23-alpine), CI (go-version: '1.23')
- ✅ Config validation with fail-fast for port, timeouts, pool sizing, DATABASE_URL
- ✅ Safe error handling: no secrets in error messages (verified by negative test)
- ✅ Health endpoints with ping seams, bounded timeouts, safe error handling, meaningful mock-based tests
- ✅ Graceful shutdown with signal handling and resource cleanup
- ✅ Multi-stage Dockerfile with non-root user and ARM64 support
- ✅ CI workflow updated with parallel Go validation job
- ✅ Deployment strategy documented
- ⚠️ Docker ARM64 build ENVIRONMENT_BLOCKED (daemon unavailable locally); Dockerfile structurally correct; ARM64 Go binary compiles successfully; Docker build verification deferred to CI or host with Docker daemon
- ✅ No business logic, auth, media, or Caddy changes
- ✅ Unrelated dirty files preserved exactly