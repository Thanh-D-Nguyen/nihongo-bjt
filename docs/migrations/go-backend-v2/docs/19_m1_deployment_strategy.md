# 19 — M1 Deployment Strategy

## Parallel Runtime Topology

During migration, the Go API runs **alongside** the existing NestJS API on the same host. No traffic is routed to Go until explicit cutover waves (M8+).

```text
┌─────────────────────────────────────────────────────────┐
│ Host (GCP VM / OCI A1)                                  │
│                                                         │
│  Caddy (reverse proxy)                                  │
│   ├── api.__DOMAIN__  → :4000  (NestJS — current prod)  │
│   └── (no Go route yet)                                 │
│                                                         │
│  Processes:                                             │
│   ├── NestJS API        :4000  (PM2 managed)            │
│   ├── Go API            :4001  (PM2 or systemd)         │
│   ├── Next.js Web       :3000                           │
│   ├── Next.js Admin     :3001                           │
│   └── Keycloak          :8080  (Docker Compose)         │
│                                                         │
│  Docker Compose infrastructure:                         │
│   ├── PostgreSQL        :15432                          │
│   ├── Redis             :6379                           │
│   ├── Meilisearch       :7700                           │
│   └── MinIO             :9000/:9001                     │
└─────────────────────────────────────────────────────────┘
```

## Port Assignment

| Service | Port | Notes |
|---------|------|-------|
| NestJS API | 4000 | Current production; unchanged during migration |
| **Go API** | **4001** | Non-conflicting; configured via `API_GO_PORT` env |
| Next.js Web | 3000 | Unchanged |
| Next.js Admin | 3001 | Unchanged |
| Keycloak | 8080 | Docker Compose |

Port 4001 is the default in `internal/config/config.go`. Override via `API_GO_PORT` environment variable.

## Health Semantics

| Endpoint | Purpose | Dependencies | Response |
|----------|---------|--------------|----------|
| `GET /health/live` | Process liveness | None | Always `200 {"status":"ok"}` |
| `GET /health/ready` | Dependency readiness | PostgreSQL (required), Redis (if configured) | `200` if healthy; `503` if any dependency fails |

### Readiness Behavior
- **PostgreSQL**: Required. Ping with 3-second bounded timeout. Failure → `503`, `"postgres":"fail"` in response.
- **Redis**: Optional. If `REDIS_URL` is empty, readiness reports `"redis":"not_configured"` and does not fail. If configured, ping with 3-second bounded timeout.
- **Error safety**: Internal error details are logged server-side only. HTTP response contains only status strings (`ok`, `fail`, `not_configured`) — no connection strings, hostnames, or stack traces leaked.

### Container Runtime Integration
- Liveness probe: `GET /health/live` — suitable for Docker/Kubernetes `livenessProbe`
- Readiness probe: `GET /health/ready` — suitable for `readinessProbe`
- Both endpoints return JSON with `Content-Type: application/json`

## ARM64 Build Strategy

### Cross-Compilation
The Go binary is cross-compiled for linux/arm64 with CGO disabled:
```bash
GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -ldflags="-s -w -X main.version=${VERSION}" -o api-server ./cmd/api
```

This produces a fully static binary with no libc dependency, suitable for Alpine-based containers.

### Docker Multi-Stage Build
`apps/api-go/Dockerfile`:
- **Builder**: `golang:1.23-alpine` — downloads deps, compiles with TARGETOS/TARGETARCH args
- **Runtime**: `alpine:3.20` — minimal image with ca-certificates and tzdata
- **Security**: Non-root `appuser` in `appgroup`; binary is the only artifact copied
- **Architecture**: Defaults to `linux/arm64` via ARG; overridable at build time

### Build Verification
- Local ARM64 cross-compilation: verified via `GOOS=linux GOARCH=arm64 go build`
- Docker buildx: requires running Docker daemon; classified ENVIRONMENT_BLOCKED when daemon unavailable
- CI: `go-checks` job validates ARM64 cross-compilation on every PR

## Eventual Caddy Cutover Strategy (NOT performed in M1)

When business endpoints are migrated (M8+), Caddy will be updated to route specific paths to the Go API:

```caddyfile
# Future state (NOT current)
api.__BASE_DOMAIN__ {
    # Migrated routes → Go
    handle /health/* { reverse_proxy 127.0.0.1:4001 }
    handle /api/v2/*  { reverse_proxy 127.0.0.1:4001 }

    # Remaining routes → NestJS
    reverse_proxy 127.0.0.1:4000
}
```

Cutover will be incremental: one domain/path group at a time, with rollback = revert Caddy config. No DNS changes required.

## Process Management

### Current GCP Production
Go API will be added to PM2 alongside NestJS:
```javascript
// ecosystem.config.cjs addition (future)
{
  name: 'nihongo-api-go',
  script: './api-server',
  cwd: '/opt/kotobawork/api-go',
  env: { NODE_ENV: 'production' },  // not used by Go, but conventional
}
```

### OCI Target
Same PM2 approach or systemd unit; decision deferred to OCI deployment wave.

## Environment Variables

See `internal/config/config.go` for complete list. Key variables:

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| DATABASE_URL | YES | — | Same PostgreSQL as NestJS |
| REDIS_URL | No | "" | Same Redis as NestJS; optional |
| API_GO_PORT | No | "4001" | Must not conflict with NestJS :4000 |
| LOG_LEVEL | No | "info" | debug/info/warn/error |

The Go service shares the same PostgreSQL and Redis instances as NestJS. No separate databases or caches.

## Rollback

Rollback from M1 = stop the Go process. No schema changes, no Caddy changes, no NestJS modifications. The Go service is purely additive.