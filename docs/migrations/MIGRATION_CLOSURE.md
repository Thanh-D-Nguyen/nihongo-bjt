# Migration Closure Record

**Status**: LEGACY RUNTIME REMOVED — PARITY GAPS OPEN (see "Known gaps", final review 2026-10-02)
**Date**: 2026-10-02
**Authoritative Backend**: Go API (`apps/api-go`)

---

## Summary

The legacy NestJS backend (`apps/api/`) has been fully removed from the repository. The Go API is now the sole authoritative backend for all production, staging, and development environments.

## Pre-Removal Baseline (2026-10-02)

All gates passed before legacy removal:

| Gate | Result |
|------|--------|
| `gofmt` | PASS (after formatting) |
| `go vet ./...` | PASS |
| `go test ./...` | PASS (9 packages with tests) — DB integration tests skipped; see correction below |
| `go test -race ./...` | PASS |
| ARM64 Linux build | PASS |
| CI workflow (`ci.yml`) | Configured for Go checks |

## Legacy Dependency Audit

### Removed
- `apps/api/` directory — NestJS source already deleted in prior migration waves
- Stale nested duplicate `apps/api-go/apps/api-go/` — removed during this session

### Reclassified as Historical/Documentation Only
| Reference | Classification | Action |
|-----------|---------------|--------|
| `.env.example` comments referencing `apps/api/` | HISTORICAL_ONLY | Updated to reflect Go-only architecture |
| `deploy/gcp/deploy-release.sh` reference to `apps/api/.env.local` | DEAD_REFERENCE | No-op (file doesn't exist; rm -f is safe) |
| `deploy/gcp/ecosystem.config.cjs` comment | HISTORICAL_ONLY | Comment only; no runtime effect |
| `packages/database/admin-api-registry.json` sourceOfTruth path | DEAD_REFERENCE | Points to deleted file; registry is informational |
| `packages/shared/src/admin-permissions.ts` JSDoc `@see` | HISTORICAL_ONLY | Documentation reference only |
| `apps/admin/` source comments referencing `apps/api/` | HISTORICAL_ONLY | UI code comments; no runtime dependency |

### Active Runtime Dependencies on Legacy
**NONE** — All production routing goes through Caddy → Go API (`:4001`). No NestJS service exists in any docker-compose, Caddyfile, or deployment configuration.

## Post-Removal Verification

> **Correction (final review, 2026-10-02).** The original "all packages pass" result was produced without
> `TEST_DATABASE_URL`: 152 of 393 Go tests (`t.Skip`) never ran — login, session, RBAC, lifecycle — and CI had no
> database either. Run against the canonical schema, 106 of them failed (stale test fixtures plus a real
> `POST /api/admin/actors` defect). Fixtures and the defect were fixed; CI now provisions PostgreSQL, and any
> unexpected skip fails (`scripts/quality/check-go-test-report.mjs`). Current result on the canonical schema:
> 415 passed, 6 allowed skips (Meilisearch search tests — harness broken, never executed).

## Known gaps (final review, 2026-10-02)

Legacy *code and runtime* are gone; these are Go-side parity defects, not dependencies on NestJS:

1. **Realtime protocol mismatch.** `apps/web` connects with `socket.io-client` (`/socket.io`, namespaces `/battle`,
   `/presence`) — the legacy NestJS contract. The Go API serves plain WebSocket at `/ws/battle` and `/ws/presence`
   with a different envelope, and `deploy/linux/Caddyfile` does not route `/ws/*`. Battle/presence realtime does not
   work end-to-end. Presence tracking is also inert (`PresenceHandler.SetService` is never called).
2. **Go SQL vs canonical schema drift.** 164 static SQL statements (106 distinct fingerprints) reference tables or
   columns that the canonical schema does not have, or omit NOT NULL columns without defaults (e.g. study plan,
   flashcard decks, onboarding, notification preferences, admin user invite). These statements cannot execute
   (PostgreSQL rejects them at PREPARE/INSERT), so the code paths using them fail at runtime.
   Tracked and ratcheted in `apps/api-go/internal/postgres/testdata/sql_conformance_baseline.json`.
3. **Go-side SQL migrations** (`apps/api-go/internal/postgres/migrations/*.sql`) have no runner in any deploy path;
   whether they were applied in production cannot be verified from the repository. CI applies them for tests.

## Current Architecture

```
Internet → Caddy → Go API (:4001)
                 → Learner Next.js (:3000)
                 → Admin Next.js (:3001)
                 → Static media (file_server)
```

No legacy backend service exists in any environment.

## Source of Truth

Going forward, accepted behavior is defined by:
1. Product requirements and specifications
2. Explicit API/domain contracts
3. Executable automated tests (unit, integration, contract, E2E)
4. Architecture rules documented in `docs/engineering/ENGINEERING_POLICY.md`
5. Production/runtime invariants enforced by CI

Legacy parity testing is **CLOSED**. Future development follows Evidence-Driven TDD per the engineering policy.

## Related Documents

- [Engineering Policy](../engineering/ENGINEERING_POLICY.md)
- [Go Backend Migration Kit v2](go-backend-v2/START_HERE.md)
- [Orchestration State](go-backend-v2/ORCHESTRATION_STATE.md)