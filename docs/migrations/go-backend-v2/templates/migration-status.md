# Migration Status (Revised)
## Current checkpoint
- Wave: M2 (persistence REVISED, credential gate pending) → M3 scaffolding next (verifier blocked)
- Accepted M0 checkpoint: `8808472426195547c779c662981d8dc582b580ca`
- Accepted H0 checkpoint: `17c3e606b0a333103445ed054582b726bff52781`
- Accepted M1 checkpoint: `0cb530224b8f4cedaea37b442254c2835bc03d08`
- M2 initial commit: `37e0b68c49712fe3665a0e847cc6ce6221b4ed9a` (REVISE after independent review)
- M2 report: `reports/M2_AUTH_PERSISTENCE_REPORT.md`
- Status: M2_PERSISTENCE_PASS_CREDENTIAL_GATE_PENDING (REVISED) — additive auth/session schema (4 tables in auth schema) with NO hardcoded algorithm/parameter defaults; CHECK constraints enforce positive values and non-empty salt/hash; redundant indexes removed; rollback guidance corrected to code-level; full Prisma migration chain on Postgres 17 FAILED at 20260425020754_phase_00_data_import (PRE_EXISTING); M2 migration separately verified on fresh Postgres 17; Keycloak credential HARD GATE classified GATED_UNKNOWN_PRODUCTION (dev metadata only; production UNVERIFIED); M3 credential verifier BLOCKED until production format confirmed
## Completed
- Repository inventory captured (100 controllers, 710 HTTP routes, 174 Prisma models, 22 PostgreSQL schemas)
- API compatibility matrix COMPLETE: 710 per-route rows extracted from all 100 controller files
- Auth behavior matrix populated (learner, admin, mobile, realtime, OAuth, RBAC)
- Media migration inventory populated (13 key patterns, 6 DB reference types)
- Background job inventory complete (5 cron classes, 10 @Cron decorators, 0 BullMQ workers confirmed)
- Realtime inventory CORRECTED: 2 gateways, 2 frontend consumer files (was incorrectly reported as zero)
- Infrastructure/deployment inventory complete (PM2 on GCP VM, Docker Compose infra, Caddy reverse proxy)
- ARM64 audit complete with command-level evidence (4/5 images VERIFIED, MinIO NOT CONFIRMED)
- Next.js BFF route handler inventory complete (17 routes: 10 web + 7 admin, all Keycloak auth)
- Quality baseline EXECUTED: typecheck PASS, lint FAIL (PRE_EXISTING tmp/ files), test FAIL (ENVIRONMENT_BLOCKED), build PASS
- Resource baseline ATTEMPTED: Docker daemon unavailable locally (ENVIRONMENT_BLOCKED with exact error)
- Prisma schema validation PASS (174 models, 22 explicit schemas)
## Blockers
- Google OAuth production status: GATED_UNKNOWN_PRODUCTION (requires runtime/env evidence) → M4
- Keycloak credential format: GATED_UNKNOWN (requires Keycloak export investigation) → M2 HARD GATE
- MinIO object counts/sizes: GATED_UNKNOWN (requires running MinIO instance) → M7
- MinIO ARM64 image: NOT CONFIRMED (script returned NOT CONFIRMED for this tag format) → M1
- Integration tests: ENVIRONMENT_BLOCKED (Docker daemon not running locally) → M1
- Resource baseline: ENVIRONMENT_BLOCKED (Docker daemon not running locally) → M7
## Tests
| Gate | Command | Result | Classification |
|---|---|---|---|
| Prisma validate | `pnpm prisma:validate` | PASS (exit 0) | ✅ CLEAN |
| Typecheck | `pnpm typecheck` | PASS (8/8 tasks, exit 0) | ✅ CLEAN |
| Lint | `pnpm lint` | FAIL (75 errors, 25 warnings) | ⚠️ PRE_EXISTING — all in `tmp/` scratch files, zero in app source |
| Tests | `pnpm test` | FAIL (4 failed / 855 passed) | ⚠️ ENVIRONMENT_BLOCKED — DB unreachable (Docker not running) |
| Build | `pnpm build` | PASS (7/7 tasks, exit 0) | ✅ CLEAN |
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
1. H0: Documentation hygiene classification based on M0 findings
2. M1: Go foundation + deployment foundations
3. M2: Keycloak credential investigation gate (HARD GATE)
4. M4: Google OAuth migrate/retire decision
5. M7: MinIO object reconciliation