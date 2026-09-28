# Migration Status

## Current checkpoint

- Wave: M0
- Starting HEAD: `0fc4486f5cfd2edc4433359753be573605234006`
- Current HEAD: (pending commit)
- Status: IN_PROGRESS

## Completed

- Repository inventory captured (100 controllers, 710 routes, 174 Prisma models)
- Auth behavior matrix populated (learner, admin, mobile, realtime, OAuth)
- Media migration inventory populated (13 key patterns, 6 DB reference types)
- API compatibility matrix summary populated (route counts, auth distribution)
- Background job inventory complete (5 crons, 0 BullMQ workers)
- Realtime inventory complete (2 gateways, 11 events, 0 frontend consumers)
- Infrastructure/deployment inventory complete (PM2 on GCP VM, Docker Compose infra)
- ARM64 audit complete (all images multi-arch, sharp is ARM64-safe)
- Next.js BFF route handler inventory complete (17 routes, all Keycloak auth)
- Prisma schema validation PASS

## In progress

- Quality baseline (typecheck/lint/test/build pending environment verification)
- Resource baseline (local Docker services not verified running)

## Blockers

- Google OAuth production status: GATED_UNKNOWN_PRODUCTION (requires runtime/env evidence)
- Keycloak credential format: GATED_UNKNOWN (requires Keycloak export investigation in M2)
- MinIO object counts/sizes: GATED_UNKNOWN (requires running MinIO instance)
- Full API route detail matrix: summary captured; per-route detail for all 710 routes deferred to M1+ as needed

## Tests

| Gate | Result | Evidence |
|---|---|---|
| Prisma validate | PASS | `pnpm prisma:validate` exit 0; schema valid |
| Typecheck | PENDING | Environment Node version mismatch warning (24.12.0 vs 24.16.0 wanted) |
| Lint | PENDING | Not yet executed |
| Tests | PENDING | Not yet executed |
| Build | PENDING | Not yet executed |

## Compatibility

- Migrated routes: 0 (M0 is investigation only)
- Remaining Nest routes: 710
- Auth users migrated: 0
- Remaining Keycloak dependencies: ALL (learner, admin, mobile, realtime, BFF)

## Rollback

Current rollback path:

```text
No migration applied. Existing NestJS/Keycloak/MinIO/GCP paths fully retained.
Rollback = do nothing.
```

## Next actions

1. Complete quality baseline (typecheck, lint, test, build) when environment permits
2. H0: Documentation hygiene classification based on M0 findings
3. M1: Go foundation + deployment foundations
4. M2: Keycloak credential investigation gate (HARD GATE)