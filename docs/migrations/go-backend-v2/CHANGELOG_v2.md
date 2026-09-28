# v2 Architecture Changes

The migration kit was updated after reviewing the Oracle A1 target and current MinIO situation.

## Changed

### MinIO

Old plan:

```text
Go → MinIO
```

New plan:

```text
Go → BlobStore → gocloud.dev/blob/fileblob → local Oracle data volume
```

MinIO is now a migration source only and must be removed after validated cutover.

### Media delivery

Public/cacheable image/audio traffic should be:

```text
Browser → Caddy → local media filesystem
```

instead of:

```text
Browser → Go → storage
```

unless authorization is required.

### Future S3 portability

The storage abstraction is explicitly designed to switch later to:

```text
s3blob → RustFS / S3 / R2
```

without domain rewrite.

RustFS is optional future infrastructure, not part of the current target.

### Next.js

Added explicit audit for:

- Admin static export;
- learner Web static export.

Admin static export is preferred when repository truth allows it.

### Resource budget

Removed MinIO allocation.

Expected final runtime gains additional headroom.

### Migration waves

Added dedicated:

- BlobStore/media migration wave;
- frontend static-runtime reduction wave;
- MinIO disable/retirement gate.

### Definition of Done

Now includes:

- media reconciliation;
- checksums;
- public/private media verification;
- MinIO zero-dependency proof;
- static frontend decisions.
