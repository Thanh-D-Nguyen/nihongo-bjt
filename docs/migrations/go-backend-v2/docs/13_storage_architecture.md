# 13 — Storage Architecture: Replace MinIO Without Replacing It With Another Server (Rebaselined)

## Decision

KotobaWork's default production target is:

```text
Go BlobStore abstraction
        ↓
gocloud.dev/blob
        ↓
fileblob
        ↓
/srv/kotobawork/data/media
```

Do not run MinIO in the final target.

Do not deploy RustFS, Garage, SeaweedFS, or another object-storage daemon by default.

## Rationale

KotobaWork currently targets a single Oracle VM and a single persistent data-volume failure domain.

Running an object-storage server on the same host/volume does not create real storage redundancy.

It adds operational cost:

- process/container;
- RAM;
- credentials;
- TLS/internal API;
- upgrade lifecycle;
- storage service recovery;
- security surface.

Local blob storage is simpler and faster for this topology.

## Application contract

Business code must never depend directly on:

```text
MinIO client
local absolute paths
S3-specific request structures
```

Use an internal interface.

Recommended capabilities:

```text
Put
Open
Stat
Delete
```

Optional only if needed:

```text
ListPrefix
Move/Copy
```

Do NOT include `SignedReadURL` or `SignedWriteURL` in the core interface. `fileblob` does not support presigned URLs. The upload architecture has been changed to server-proxied streaming uploads. See below.

## Upload architecture (FINAL DECISION)

The current browser-direct presigned PUT upload flow is REPLACED with:

```text
Browser → Go API → streaming upload → temp file → validate → atomic rename → LocalFS
```

Implementation MUST:

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

## Go Cloud

Use `gocloud.dev/blob`.

Initial driver:

```text
gocloud.dev/blob/fileblob
```

Future:

```text
gocloud.dev/blob/s3blob
```

This keeps the storage layer portable.

## Object keys

Use stable slash-separated object keys, e.g.:

```text
bjt/questions/<question-id>/image/main.webp
bjt/questions/<question-id>/audio/prompt.mp3
users/<user-id>/avatar.webp
```

Object keys are not absolute host paths.

Reject:

```text
..
leading filesystem root
NUL
unexpected control characters
untrusted path escaping
```

## Filesystem layout

Canonical OCI data path:

```text
/srv/kotobawork/data/media/
├── public/
│   ├── bjt/
│   ├── generated/
│   └── ...
├── private/
│   ├── users/
│   └── ...
└── tmp/
    └── (streaming upload temp files)
```

Separate public and private roots. Caddy serves only `public/`. Go serves `private/` with auth.

## Writes

Production writes use the streaming upload architecture:

```text
create temp file in /srv/kotobawork/data/media/tmp/
→ stream content from HTTP request body (MaxBytesReader bounded)
→ validate content type, size, filename
→ compute checksum where useful
→ fsync when durability requires it
→ atomic rename into final key under public/ or private/
→ clean temp file on any error path
```

Do not expose half-written media.

## Reads

Public/cacheable media:

```text
Browser → Caddy → /srv/kotobawork/data/media/public
```

Protected media:

```text
Browser → Go API → auth → authorization → http.ServeContent → filesystem stream
```

Do not make all public images/audio pass through Go.

Do NOT expose private media through Caddy file_server.

Do NOT introduce custom Caddy auth plugins during this migration.

## HTTP range

Audio playback benefits from proper range support.

Caddy `file_server` supports Range requests natively for public media.

Go private media delivery must use `http.ServeContent` or equivalent to support Range semantics correctly. Verify with actual BJT audio clients.

## Metadata

PostgreSQL stores:

```text
object_key
content_type
size_bytes
sha256
visibility (public/private)
created_at
updated_at
```

Avoid duplicating the binary payload in PostgreSQL.

## Backup

Local data is not a backup.

Design separate backup of:

- PostgreSQL;
- media (both public and private);
- essential config.

A backup must have restore evidence.

## Future migration to S3

A later transition should require primarily:

```text
fileblob backend
↓
s3blob backend
```

plus deployment/config changes.

Business services should remain unchanged.

Potential future backends:

- RustFS;
- AWS S3;
- Cloudflare R2;
- another S3-compatible service.

RustFS is a future deployment option, not a current dependency.

## MinIO migration

Migration must be idempotent.

For every source object record:

```text
bucket
key
size
etag/checksum if meaningful
content type
DB reference
destination key
copy status
validation status
public/private classification
```

After copy:

- compare object counts;
- compare sizes;
- compare content checksum when feasible;
- exercise representative images/audio;
- test new uploads via streaming endpoint;
- test deletion semantics;
- test restart persistence;
- verify public media served by Caddy;
- verify private media served by Go with auth.

Do not delete source MinIO until the rollback window closes.