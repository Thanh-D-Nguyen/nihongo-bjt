# 02 — Target Architecture v2 (Rebaselined)

## Preferred target

```text
                         Internet
                            │
                          Caddy
                            │
          ┌─────────────────┼───────────────────┐
          │                 │                   │
          ▼                 ▼                   ▼
     Next Web          Admin Static        /media/public/*
 (KEEP_NEXT_         (eval post-M6)            │
  RUNTIME)              │                  Caddy file_server
          │                │                    │
          └────────────┐   │                    ▼
                       ▼   ▼             /srv/kotobawork/data/media
                         Go API
                           │
              ┌────────────┼─────────────┐
              │            │             │
              ▼            ▼             ▼
         PostgreSQL      Redis      Meilisearch
              │
        Auth / Session
```

## Removed in final state

- NestJS
- Keycloak
- MinIO
- Admin Node runtime (only if static export passes post-M6 evaluation)

Learner Web Node runtime is **retained** (KEEP_NEXT_RUNTIME).

## Storage

Application storage API:

```text
MediaService
    ↓
BlobStore
    ↓
gocloud.dev/blob
    ↓
fileblob
    ↓
/srv/kotobawork/data/media
```

Caddy serves public/cacheable files directly from `/srv/kotobawork/data/media/public`.

Private media is served by Go API with authentication and authorization, streaming via `http.ServeContent` or equivalent.

### Upload architecture (FINAL DECISION)

`fileblob` does not support presigned URLs. The current browser-direct presigned PUT upload flow is replaced with:

```text
Browser → Go API → streaming upload → temp file → validate → atomic rename → LocalFS
```

Implementation requirements:
- stream, never buffer entire upload in RAM
- enforce MaxBytesReader/equivalent size limits
- validate filename/object key; prevent traversal
- validate allowed content type; inspect actual content where appropriate
- compute checksum where useful
- clean partial/temp files after error
- use safe atomic finalization
- support cancellation
- handle duplicate/retry semantics deliberately

Do NOT implement custom signed PUT URLs in Caddy.

### Media read paths

Public/cacheable media:
```text
Browser → Caddy → /srv/kotobawork/data/media/public
```

Private media:
```text
Browser → Go API → auth → authorization → filesystem stream (http.ServeContent)
```

Do NOT expose private media through Caddy file_server.
Do NOT introduce custom Caddy auth plugins during this migration.

## Why no replacement object-storage server by default

On a single host with a single block-volume failure domain, an S3 server does not create real redundancy.

It adds:
- another daemon/container;
- RAM;
- credentials;
- upgrade lifecycle;
- security surface;
- additional failure modes.

S3 compatibility remains available later through `s3blob`.

## Backend design principles

- explicit composition;
- thin HTTP handlers;
- domain/service layer independent of transport;
- typed DB queries;
- bounded concurrency;
- context cancellation;
- structured errors;
- graceful shutdown;
- no framework magic.

## Public traffic

Expected:
```text
80/443 → Caddy only
```

Internal-only services:
```text
PostgreSQL
Redis
Meilisearch
```

No direct public DB/search/cache ports.

## Media path

Prefer stable object-key semantics.

Example:
```text
bjt/questions/<id>/images/main.webp
bjt/questions/<id>/audio/prompt.mp3
avatars/<user-id>/avatar.webp
```

Do not persist absolute host paths inside business DB rows. Persist the object key instead.

## Frontend runtime classification

### Learner Web: KEEP_NEXT_RUNTIME
Repository evidence:
- `force-dynamic` layout
- server-side `cookies()` reads
- server-side auth shell (`KeycloakAuthShell`)
- runtime auth behavior
- server-loaded i18n messages
- Socket.IO client integration

Do NOT attempt static export during this migration.

### Admin: NEEDS_INVESTIGATION_POST_M6
Admin currently uses `force-dynamic` with server-side Keycloak session gating.
Static export evaluation occurs ONLY after M6 (admin auth cutover) proves Go cookie sessions work correctly.
Admin static export is an optimization, not a prerequisite.

See `docs/14_static_frontend_audit.md`.

## Mobile client

The Flutter mobile app (`nihongo-mobile` Keycloak client) is explicitly in scope for auth migration.
PKCE/public-client security semantics must be preserved.
Keycloak retirement gate requires mobile migrated or explicitly retired with evidence.

See `docs/15_mobile_auth_migration.md`.

## Background jobs

Dedicated migration wave (M10).
Current known scope includes cron jobs and BullMQ workers embedded in NestJS.
M0 must inventory all producers, consumers, scheduling, retries, timezones, idempotency, persistence, and failure semantics.

See `docs/16_background_jobs_migration.md`.

## Realtime

Dedicated migration wave (M12).
Current scope: BattleGateway (12+ Socket.IO events), PresenceGateway, frontend socket.io-client consumers.
Do NOT use SSE for Battle (bidirectional realtime).

See `docs/17_realtime_migration.md`.