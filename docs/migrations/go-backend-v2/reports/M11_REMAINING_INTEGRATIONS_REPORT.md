# M11 — Remaining Integrations Report

**Date:** 2026-09-29
**Accepted HEAD:** c3ba6f32 (M10 background jobs)
**Branch:** main
**Status:** PASS

## Summary

M11 completes the remaining NestJS integrations required before retirement: Stripe webhook migration, image processing decision, search orchestration closure, and a full inventory of remaining Nest-only dependencies.

## 1. Stripe/Billing Webhook Migration

### Implementation

- **File:** `apps/api-go/internal/httpserver/handler_webhook.go`
- **Route:** `POST /api/webhooks/stripe` (public, no auth guard)
- **Config:** `STRIPE_WEBHOOK_SECRET` added to `internal/config/config.go`

### Security Contract Preserved

| Requirement | Status | Evidence |
|---|---|---|
| Raw body read before JSON parsing | Done | `io.ReadAll` before `json.Unmarshal` |
| HMAC SHA256 signature verification | Done | `verifyStripeSignature()` with timestamp replay protection (5min window) |
| Idempotency via unique constraint | Done | `ingestWebhookEvent()` catches PG 23505 / duplicate key errors |
| Duplicate returns 200 `{received: true}` | Done | Explicit check for `errDuplicateWebhook` |
| Audit log per webhook received | Done | `writeMonetizationAudit()` writes to `monetization.monetization_audit_log` |
| Fail closed when secret missing | Done | Returns 503 if `STRIPE_WEBHOOK_SECRET` is empty |
| Body size limit | Done | 1 MiB max via `io.LimitReader` |

### Differences from NestJS

- NestJS uses the Stripe SDK (`stripe.webhooks.constructEvent`) for signature verification. Go implementation uses raw HMAC-SHA256 per Stripe's documented algorithm — functionally equivalent without requiring the Stripe Go SDK dependency.
- Business logic dispatch is a no-op placeholder (`markWebhookProcessed`). Future milestones will add subscription/entitlement handlers.
- Dead-letter path exists in schema but retry logic is deferred to background jobs (M10 infrastructure available).

## 2. Image Processing Decision

### Decision: DEFERRED (501 stub)

**Rationale:**

The NestJS `share-image.renderer.ts` uses `sharp` for SVG-to-PNG rendering with:
- Custom Japanese font stacks (`Noto Sans JP`, `Hiragino Sans`, `Yu Gothic`)
- Complex SVG features: linear gradients, pattern overlays (dots, grid, waves, stripes), opacity layers
- Text truncation and layout calculations based on character width estimates
- 7 distinct template kinds with different visual compositions

Go equivalents require:
1. A full SVG rasterizer (e.g., `github.com/nicholasgasior/gosvg` or `github.com/srwiley/rasterx`) — neither supports the full SVG feature set used (gradients, patterns, text-anchor, letter-spacing)
2. Font file loading and CJK glyph rasterization — requires bundling Noto Sans JP (~16MB) or system font detection
3. Significant new dependencies that add attack surface and maintenance burden for a non-core feature

**Implementation:** `shareImageStubHandler()` returns HTTP 501 with message "share image generation not yet implemented". Route registered at `GET /api/share/image/{kind}`.

**Recommendation:** Implement when share image generation is product-critical. Consider using an external service (e.g., Puppeteer/Playwright screenshot API, or a dedicated image generation microservice) rather than in-process SVG rasterization.

## 3. Search Orchestration Closure

### Verification

- `search.Client` initialization added to `internal/app/app.go` — creates client when `MEILISEARCH_URL` is set
- `SearchClient` field already present in `httpserver.Dependencies` struct
- Search routes already wired in `server.go` with proper nil checks (`if deps.SearchClient != nil && deps.SessionStore != nil`)
- All M8 search endpoints compile and wire correctly

### Status: COMPLETE

No additional changes needed beyond wiring `search.NewClient()` into the dependency injection.

## 4. Remaining NestJS Dependencies Inventory

External services identified in NestJS source that are NOT yet migrated to Go:

| Service | NestJS Package | NestJS Consumer(s) | Go Status | Priority |
|---|---|---|---|---|
| **Stripe SDK** | `stripe` | `stripe-billing.provider.ts` | Webhook sig verify reimplemented natively; full SDK not needed yet | Low |
| **Sharp** | `sharp` | `share-image.renderer.ts`, `media.service.ts` | Deferred (501 stub); media thumbnails not yet migrated | Medium |
| **MinIO/S3** | `minio` | `share.service.ts`, `media.service.ts` | Media store uses local filesystem + gocloud.dev/blob abstraction | Low |
| **Socket.IO** | `socket.io` | `battle.gateway.ts`, `presence.gateway.ts` | Not migrated; realtime battle/presence is future milestone | High |
| **Redis** | `redis` | `presence.service.ts` | Redis client exists (`redisx` package); presence not wired | Medium |
| **Meilisearch** | `meilisearch` | `search.service.ts` | Client implemented (M8); orchestration verified (M11) | Done |
| **web-push** | `web-push` | `push-notification.service.ts` | Not migrated; push notifications are future milestone | Medium |
| **kuromoji** | `kuromoji` | `japanese-morphology.ts` | Reading assist layer not migrated; complex CJK NLP | High |
| **wanakana** | `wanakana` | `search.service.ts` | Romaji/hiragana conversion not migrated | Medium |
| **jose** | `jose` | `keycloak-token.service.ts` | Keycloak/JWT verification not migrated | Medium |
| **helmet** | `helmet` | `main.ts` | Security headers handled by middleware/Caddy | Low |
| **class-validator** | `class-validator` | DTOs throughout | Go uses manual validation in handlers | Done |
| **zod** | `zod` | Admin/analytics schemas | Go uses manual validation | Done |

### Services Already Migrated (M1-M11)

- PostgreSQL (pgx/v5)
- Redis/BullMQ → robfig/cron + PG advisory locks (M10)
- Meilisearch (M8)
- Session/auth (M5)
- RBAC (M6)
- Media storage with gocloud.dev/blob (M7)
- Account lifecycle (M5)
- Business writes: bookmarks, exercises, quiz sessions (M9)
- Background jobs infrastructure (M10)
- Stripe webhooks (M11)

## Static Gates

| Gate | Result |
|---|---|
| `go build ./...` | PASS |
| `go vet ./...` | PASS |
| `go test ./...` | PASS (all packages) |
| `go test -race ./...` | PASS |
| `gofmt -l .` | PASS (after fix) |
| `GOOS=linux GOARCH=arm64 go build ./...` | PASS |

## Files Changed

| File | Change |
|---|---|
| `apps/api-go/internal/config/config.go` | Added `StripeWebhookSecret` field + env loading |
| `apps/api-go/internal/httpserver/handler_webhook.go` | NEW: Stripe webhook handler, signature verification, idempotent ingest, audit logging, share image stub |
| `apps/api-go/internal/httpserver/server.go` | Wired webhook route + share image stub route |
| `apps/api-go/internal/app/app.go` | Added `search.NewClient()` initialization, imported search package |

## Next Milestone (M12) Recommendations

1. Socket.IO → WebSocket migration for battle/presence (highest remaining Nest-only dependency)
2. Kuromoji/wanakana replacement for reading assist layer
3. Push notification provider (web-push or FCM/APNs)
4. Share image generation (when product-critical)
5. Full Stripe SDK integration (if subscription management grows complex)