# 05 — API Migration Strategy (Rebaselined)

## Default approach

Migrate by cohesive domain, not random endpoints.

For each domain:

```text
Discover
→ Specify contract
→ Implement Go
→ Contract test
→ Shadow/compare where possible
→ Switch caller
→ Monitor
→ Deprecate Nest
→ Remove old route
```

## Contract dimensions

Record:

- path;
- HTTP method;
- auth requirement;
- accepted query params;
- body schema;
- response schema;
- error status codes;
- error body shape;
- pagination;
- sorting;
- timestamps/time zones;
- nullable fields;
- side effects;
- transaction behavior;
- idempotency;
- authorization;
- rate limits.

## Compatibility tests

Prefer black-box tests that can execute the same request against:

```text
Nest implementation
Go implementation
```

Normalize only known nondeterministic fields such as:

- generated IDs;
- timestamps;
- request IDs.

Do not normalize away behavioral differences.

## Recommended migration order

Actual order must come from repository coupling, but usually:

1. health/config foundations;
2. read-only reference/content APIs;
3. profile/user reads;
4. low-risk writes;
5. practice/progress;
6. exam/session;
7. admin CRUD;
8. uploads/media (streaming upload architecture);
9. search orchestration;
10. billing webhooks;
11. background jobs / cron workers;
12. realtime/websocket;
13. image processing.

Auth is its own controlled workstream and may precede business routes.

## Transactions

Identify NestJS operations that depend on Prisma transactions.

Port atomicity explicitly.

Never convert:

```text
one transaction
```

into:

```text
several unrelated SQL statements
```

without equivalent transaction boundaries.

## Validation

Replicate client-observable validation behavior when compatibility matters.

Internally prefer Go-native validation over copying decorator frameworks.

## Error handling

Define one central error mapping policy.

No stack traces or SQL errors in production responses.

Log server detail with request correlation ID.

## Search

Meilisearch remains specialized search infrastructure.

Do not replace it with custom Go search as part of this migration.

## Media / object storage

Do not carry MinIO SDK assumptions into the Go domain layer.

Use the application `BlobStore` abstraction backed initially by `gocloud.dev/blob/fileblob`.

Store object keys/metadata in PostgreSQL as current design requires.

Public/cacheable image/audio reads should normally be served by Caddy directly from the media root.

Private/protected assets must retain explicit authorization via Go streaming delivery.

Do not put large binary payloads directly into PostgreSQL merely to simplify migration.

Do not deploy a replacement S3 server unless a concrete requirement exists.

See `docs/13_storage_architecture.md` and `docs/18_media_delivery_architecture.md`.

## Billing webhooks

Stripe/billing webhook migration is explicit scope.

Preserve exact signature verification and idempotency semantics.

Do not generalize or simplify payment security.

## Image processing

Sharp is used for image resizing/proxying and share-image rendering.

M0/M11 must inventory actual operations.

Then choose: implement in Go, temporarily retain narrowly scoped worker, or simplify safely.

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