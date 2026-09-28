# M1 Go Foundation Report

## Identification
- **Starting HEAD**: `025124c3336f819b9ac0d30ba80c1da752800f92`
- **Final HEAD**: (pending final repair commit)
- **Branch**: `main`
- **Wave**: M1 — Go foundation + deployment foundations
- **Date**: 2026-09-28
- **Accepted H0 checkpoint**: `17c3e606b0a333103445ed054582b726bff52781`
- **Initial M1 commit**: `54ef68d4aba33f6de59ffa39ca9844d038850873` (REVISE after independent review)
- **Toolchain repair commit**: `1f76f8ce658639cfbe9c554887a8aee55641a206`
- **Dependency alignment commit**: `b80a174d7dea242e5e9ac2382eaeda87dbed85e6`

## Scope
Go module scaffold, config loading/validation, health endpoints, structured logging, PostgreSQL pool, Redis client, graceful shutdown, ARM64 build verification, CI integration, Dockerfile, and deployment strategy documentation. No business logic, auth, media, or Caddy cutover.

## Repair Summary

### REVISE Round 1 (commit 1f76f8ce)
Independent review of initial M1 commit identified six blocking findings. All addressed:
1. **Toolchain alignment**: go.mod downgraded from `go 1.26.5` to `go 1.23.0` to match Dockerfile and CI.
2. **Readiness testability**: Introduced `postgres.Pinger` and `redisx.Pinger` interfaces for mock-based testing.
3. **Config validation**: Fail-fast for port range, positive durations, pool sizing, parseable DATABASE_URL.
4. **Secret safety**: Sentinel error messages in postgres/redis packages; negative test proves non-leakage.
5. **Report accuracy**: Updated to reflect repair state.
6. **Meaningful tests**: Comprehensive coverage of live/readiness behavior with mock pingers.

### REVISE Round 2 (dependency alignment, commit b80a174d)
`pgx/v5 v5.11.0` requires Go 1.25+, incompatible with Go 1.23 target. Downgraded:
- `pgx/v5`: v5.11.0 → v5.7.6
- `go-redis/v9`: v9.22.0 → v9.7.3
- Transitive `golang.org/x/text`: resolved to v0.24.0

All verification passes with `GOTOOLCHAIN=go1.23.0`.

### REVISE Round 3 (typed-nil Redis fix, this commit)
Real ARM64 container validation revealed `/health/ready` returned HTTP 500 with empty body when REDIS_URL was unset. Root cause: `redisx.NewClient` returns `(nil, nil)` when URL is empty, but `app.go` assigned the typed-nil `*redis.Client` to `httpserver.Dependencies.Redis` interface field. A typed-nil interface is non-nil in Go, so readiness called `Ping()` on it, panicked, and chi's Recoverer middleware returned 500.

**Fix**: Guard assignment in `app.go` — only set `deps.Redis` if concrete `redisClient != nil`. Added composition-level regression test `TestComposition_NilRedis_Returns503Not500` that exercises the actual wiring path.

**Container validation after fix**:
```
docker buildx build --platform linux/arm64 -t kotobawork/api-go:m1-fix --load . => PASS
docker image inspect => arm64 linux appuser
GET /health/live  => HTTP 200 {"status":"ok"}
GET /health/ready => HTTP 503 {"checks":{"postgres":"fail","redis":"not_configured"},"status":"degraded","version":"dev"}
```

## Artifact List
| Artifact | Path | Status |
|---|---|---|
| Go module | `apps/api-go/go.mod` | REPAIRED (go 1.23.0, pgx v5.7.6, go-redis v9.7.3) |
| Go sum | `apps/api-go/go.sum` | UPDATED |
| Main entrypoint | `apps/api-go/cmd/api/main.go` | UNCHANGED |
| Config package | `apps/api-go/internal/config/config.go` | REWRITTEN (validation, safe errors) |
| Config tests | `apps/api-go/internal/config/config_test.go` | REWRITTEN (comprehensive validation tests) |
| App composition | `apps/api-go/internal/app/app.go` | REPAIRED (typed-nil Redis guard) |
| App composition tests | `apps/api-go/internal/app/app_test.go` | CREATED (composition regression test) |
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
5. **Explicit composition** — `app.New()` wires config → logger → pgx pool → redis client → router → server. No global singletons. Typed-nil guard at composition boundary prevents interface nil confusion.
6. **Graceful shutdown** — SIGTERM/SIGINT via `signal.NotifyContext`; bounded ShutdownTimeout; reverse-order resource cleanup.
7. **Port 4001** — Non-conflicting with NestJS :4000 during parallel migration. Validated at config load time.
8. **Multi-stage Dockerfile** — golang:1.23-alpine builder, alpine:3.20 runtime, non-root appuser, CGO_ENABLED=0 static binary.
9. **ARM64 target** — TARGETOS/TARGETARCH args default to linux/arm64; cross-compile verified with GOTOOLCHAIN=go1.23.0.
10. **Ping seams** — `postgres.Pinger` and `redisx.Pinger` interfaces enable testing readiness without live dependencies.
11. **Safe error handling** — All external dependency initialization returns sentinel error messages. No URLs, passwords, hostnames, or stack traces in error text.
12. **Fail-fast config** — Invalid port, negative/zero timeouts, invalid pool sizing, and unparseable DATABASE_URL all fail at startup.
13. **Typed-nil guard** — Composition root explicitly checks `redisClient != nil` before assigning to interface field, preventing Go's typed-nil interface pitfall.

## Verification Results

### Go Toolchain (all with GOTOOLCHAIN=go1.23.0)
| Check | Command | Result |
|---|---|---|
| gofmt | `gofmt -w . && test -z "$(gofmt -l .)"` | ✅ CLEAN |
| go vet | `GOTOOLCHAIN=go1.23.0 go vet ./...` | ✅ PASS |
| go test | `GOTOOLCHAIN=go1.23.0 go test ./...` | ✅ PASS (app: 2, config: 12, httpserver: 9 = 23 total) |
| go test -race | `GOTOOLCHAIN=go1.23.0 go test -race ./...` | ✅ PASS |
| ARM64 build | `GOTOOLCHAIN=go1.23.0 GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build ./cmd/api` | ✅ PASS |

### Toolchain Consistency
| Location | Version | Aligned |
|---|---|---|
| `go.mod` | `go 1.23.0` | ✅ |
| `Dockerfile` builder | `golang:1.23-alpine` | ✅ |
| `.github/workflows/ci.yml` | `go-version: '1.23'` | ✅ |

### Dependency Versions (Go 1.23 compatible)
| Dependency | Version | Go Requirement |
|---|---|---|
| `pgx/v5` | v5.7.6 | ≥ 1.21 ✅ |
| `go-redis/v9` | v9.7.3 | ≥ 1.21 ✅ |
| `chi/v5` | v5.3.2 | ≥ 1.20 ✅ |
| `golang.org/x/text` | v0.24.0 (transitive) | ≥ 1.22 ✅ |

### Docker ARM64 Build and Container Validation
| Check | Command | Result |
|---|---|---|
| Docker buildx | `docker buildx build --platform linux/arm64 -t kotobawork/api-go:m1-fix --load .` | ✅ PASS |
| Image inspect | `docker image inspect --format '{{.Architecture}} {{.Os}} {{.Config.User}}'` | ✅ `arm64 linux appuser` |
| Container /health/live | `curl http://localhost:14001/health/live` | ✅ HTTP 200 `{"status":"ok"}` |
| Container /health/ready | `curl http://localhost:14001/health/ready` (no REDIS_URL, unreachable DB) | ✅ HTTP 503 `{"checks":{"postgres":"fail","redis":"not_configured"},"status":"degraded","version":"dev"}` |
| Container cleanup | `docker rm -f m1-fix-test` | ✅ Cleaned up |

**Docker ARM64 gate: PASS** (daemon available, image built, container validated)

### Health Endpoint Behavior (verified by unit tests AND container validation)
| Endpoint | Dependency | Expected Behavior | Unit Test | Container Test |
|---|---|---|---|---|
| GET /health/live | None | Always 200 `{"status":"ok"}` | `TestLiveHandler_AlwaysOK` ✅ | ✅ HTTP 200 |
| GET /health/live | DB failing | Still 200 (independent) | `TestLiveHandler_IndependentOfDB` ✅ | — |
| GET /health/ready | All healthy | 200 ok | `TestReadyHandler_HealthyAll` ✅ | — |
| GET /health/ready | Nil DB | 503 degraded, postgres=fail | `TestReadyHandler_NilDB_Returns503` ✅ | ✅ HTTP 503 |
| GET /health/ready | DB failure | 503, postgres=fail | `TestReadyHandler_DBFailure_Returns503` ✅ | ✅ postgres=fail |
| GET /health/ready | Redis failure | 503, redis=fail | `TestReadyHandler_RedisFailure_Returns503` ✅ | — |
| GET /health/ready | No REDIS_URL | not_configured (NOT panic/500) | `TestComposition_NilRedis_Returns503Not500` ✅ | ✅ redis=not_configured |
| GET /health/ready | Internal error | No details in HTTP body | `TestReadyHandler_NoErrorDetailsInResponse` ✅ | ✅ Safe JSON only |
| GET /health/ready | Version set | Includes version field | `TestReadyHandler_VersionIncluded` ✅ | ✅ version=dev |

### Config Validation (verified by unit tests)
| Env Var | Required | Default | Validation | Test Coverage |
|---|---|---|---|---|
| DATABASE_URL | YES | — | Non-empty + parseable URL | `TestLoad_RequiresDatabaseURL`, `TestLoad_InvalidDatabaseURL` |
| API_GO_PORT | No | "4001" | Integer in [1, 65535] | `TestLoad_InvalidPort`, `TestLoad_InvalidPortNonNumeric` |
| SERVER_READ_TIMEOUT | No | 15s | Positive duration | `TestLoad_NegativeTimeout`, `TestLoad_InvalidDuration` |
| DB_POOL_MAX_CONNS | No | 20 | Positive int32, >= min | `TestLoad_PoolMaxLessThanMin` |
| DB_POOL_MIN_CONNS | No | 2 | Positive int32, >= 1 | `TestLoad_PoolMinLessThanOne` |
| Secret safety | — | — | No credentials in errors | `TestLoad_NoSecretLeakageInErrors` ✅ |

## CI Integration
`go-checks` job in `.github/workflows/ci.yml`:
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

## Rollback State
No migration applied. Existing NestJS/Keycloak/MinIO/GCP paths fully retained. Go service is purely additive. Rollback = do nothing.

## Gate Recommendation
**M1_PASS**

Rationale:
- ✅ All Go source files repaired and verified (gofmt, vet, test, race, ARM64 build with GOTOOLCHAIN=go1.23.0)
- ✅ Toolchain aligned to Go 1.23 across go.mod, Dockerfile, CI
- ✅ Dependencies downgraded to Go 1.23-compatible versions (pgx v5.7.6, go-redis v9.7.3)
- ✅ Config validation with fail-fast for port, timeouts, pool sizing, DATABASE_URL
- ✅ Safe error handling: no secrets in error messages (verified by negative test)
- ✅ Health endpoints with ping seams, bounded timeouts, safe error handling
- ✅ Typed-nil Redis interface bug fixed at composition boundary; regression test added
- ✅ Docker ARM64 build PASS; container validation confirms live=200, ready=503 with safe JSON
- ✅ Graceful shutdown with signal handling and resource cleanup
- ✅ Multi-stage Dockerfile with non-root user and ARM64 support
- ✅ CI workflow updated with parallel Go validation job
- ✅ Deployment strategy documented
- ✅ No business logic, auth, media, or Caddy changes
- ✅ Unrelated dirty files preserved exactly