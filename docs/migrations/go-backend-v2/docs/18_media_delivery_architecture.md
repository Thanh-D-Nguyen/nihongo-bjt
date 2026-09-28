# 18 — Media Delivery Architecture (Rebaselined)

## Overview

Media delivery is split into two distinct paths based on access control:

```text
Public/cacheable media:
  Browser → Caddy file_server → /srv/kotobawork/data/media/public

Private/authenticated media:
  Browser → Go API → auth → authorization → http.ServeContent → filesystem
```

This separation ensures public media does not consume Go CPU/memory, while private media retains full authorization enforcement.

## Public Media Path

### Caddy configuration

Caddy serves `/media/public/*` directly from the filesystem using `file_server`:

```caddyfile
media.__BASE_DOMAIN__ {
    root * /srv/kotobawork/data/media/public
    file_server
    header Cache-Control "public, max-age=31536000, immutable"
    encode gzip zstd
}
```

### Capabilities

- **Cache headers**: Long-lived immutable caching for content-addressed or versioned assets.
- **MIME types**: Caddy infers from file extension; ensure uploads use correct extensions.
- **HTTP Range**: Native support for audio/video seeking without Go involvement.
- **Conditional requests**: ETag/Last-Modified handled automatically by `file_server`.
- **Compression**: gzip/zstd for text-based assets (SVG, JSON metadata if served publicly).

### What belongs in public

- BJT question images/audio (published/cleared rights)
- Generated magazine content
- Kanji stroke SVGs
- Public announcement hero images
- Share postcard images
- Any asset with `rights_status: cleared` and no user-ownership restriction

### What MUST NOT be in public

- User uploads pending review
- Private flashcard images
- User avatars (unless explicitly public profile)
- Draft/unpublished content
- Any asset requiring ownership or RBAC check

## Private Media Path

### Go API handler

Private media is served through an authenticated Go endpoint:

```text
GET /api/media/private/{objectKey...}
```

Handler responsibilities:
1. Authenticate request (session cookie or bearer token)
2. Resolve object key from URL path
3. Validate object key (no traversal, valid characters, bounded length)
4. Authorize: owner check OR card-media-link check OR admin RBAC
5. Open file via BlobStore (`gocloud.dev/blob/fileblob`)
6. Serve with `http.ServeContent` for correct Range/conditional support
7. Set appropriate Cache-Control (private, no-store or short-lived)

### Streaming requirements

- Use `http.ServeContent` or equivalent — do NOT load entire file into memory.
- Support HTTP Range for audio/video playback.
- Respect context cancellation (client disconnect).
- Log access (sampled if high volume) with user ID, object key, bytes served, duration.

### Authorization model

Replicate current `MediaService.assertLearnerCanReadAsset` logic:
- Owner can always read their own assets.
- Non-owner can read only if linked via `cardMediaLink` to a flashcard they own.
- Admin actors with appropriate RBAC permission can read any asset.

## Upload Architecture

### Server-proxied streaming upload

The current browser-direct presigned PUT flow is replaced:

```text
Browser
  → POST /api/media/upload (multipart or raw body)
  → Go API streams to temp file (MaxBytesReader bounded)
  → Validate: size, content-type, filename, actual content inspection
  → Compute checksum (SHA-256) where useful
  → Atomic rename to final key under public/ or private/
  → Create/update media_asset DB row
  → Return asset metadata
```

### Implementation requirements

| Requirement | Detail |
|-------------|--------|
| Stream, never buffer | Use `io.LimitReader` + temp file; never read entire body into `[]byte` |
| Size limit | `http.MaxBytesReader` with configurable per-endpoint limits |
| Filename validation | Sanitize, reject traversal (`..`, absolute paths), bound length |
| Content-type validation | Check header AND inspect magic bytes for image/audio types |
| Checksum | SHA-256 of streamed content; store in DB for integrity |
| Temp file cleanup | Defer removal on error; use unique temp names to avoid collision |
| Atomic finalization | Write to `tmp/`, fsync, rename to final path |
| Cancellation | Respect `ctx.Done()`; clean partial temp file |
| Duplicate/retry | Idempotent by checksum or client-supplied idempotency key |

### Object key generation

```text
public/bjt/questions/{questionId}/images/{variant}.webp
public/bjt/questions/{questionId}/audio/{prompt|answer}.mp3
private/users/{userId}/uploads/{uuid}-{sanitized-filename}
private/users/{userId}/avatars/{uuid}.webp
admin/{actorId}/{uuid}-{sanitized-filename}
```

Database stores the object key (not absolute path), content type, size, checksum, visibility, rights status.

### Admin direct upload

Admin direct upload (`MediaService.adminDirectUpload`) also migrates to streaming:
- Receives multipart form or raw body
- Same validation/streaming/atomic-write pipeline
- Stores under `admin/{actorId}/` prefix
- Audit logged via `AdminAuditLog`

## Migration Steps (M7)

1. **Inventory**: Catalog all MinIO objects, classify public/private, record DB references.
2. **Copy tool**: Idempotent copy from MinIO to LocalFS with checksum validation.
3. **BlobStore implementation**: `gocloud.dev/blob/fileblob` backend with Put/Open/Stat/Delete.
4. **Upload endpoint**: Implement streaming upload handler with all validation.
5. **Private read endpoint**: Implement authorized streaming read with `http.ServeContent`.
6. **Caddy config**: Add `file_server` for public media root with cache/compression headers.
7. **Frontend cutover**: Update upload components to use new endpoint; update image URLs.
8. **Validation**: Verify counts, checksums, access patterns, Range support, auth enforcement.
9. **Rollback**: Retain MinIO data and rollback capability through stability window.

## Security Controls

| Control | Implementation |
|---------|---------------|
| Path traversal prevention | Reject `..`, absolute paths, NUL; validate against allowlist regex |
| Upload size enforcement | `http.MaxBytesReader` at handler level |
| Content-type validation | Header check + magic byte inspection for images/audio |
| Authorization on private reads | Owner/card-link/admin RBAC check before serving |
| No directory listing | Caddy `file_server` without browse; Go never lists directories |
| Temp file isolation | Unique names in dedicated `tmp/` directory; cleaned on error |
| Checksum integrity | SHA-256 stored in DB; verified on copy and optionally on read |

## Future Optimization (Post-Migration)

If production measurements justify it, a temporary-download-token mechanism could be added later:
- Go issues short-lived signed token for specific object key
- Caddy validates token via header/query param before serving
- Reduces Go load for frequently accessed private media

This is NOT part of the current migration scope. Only consider after measuring real production private-media throughput.

See also:
- `docs/13_storage_architecture.md` — BlobStore abstraction and storage principles
- `docs/07_testing_strategy.md` — Media upload/download contract tests
- `docs/10_security_baseline.md` — Media security controls