# M0 Repository Truth Report (Validation Final)

## Identification
- **Starting HEAD**: `0fc4486f5cfd2edc4433359753be573605234006`
- **Prior M0 Commits**: `6b3a5a6`, `e6506f3`, `47a7d13`, `dafb759`
- **Final HEAD**: (pending commit)
- **Branch**: `main`
- **Wave**: M0 — Repository truth / detailed inventory (VALIDATION FINAL)
- **Date**: 2026-09-28

## Revision Notes
This report supersedes all prior M0 commits. All blocking defects from four independent reviews have been addressed:

1. ✅ API compatibility matrix uses exact canonical 14-column schema
2. ✅ All 710 paths verified to start with `/api/` (proven via `app.setGlobalPrefix("api")` at main.ts:58)
3. ✅ **SESSION_BOOTSTRAP false positives fixed**: Only 1 route (`/api/admin/session`) has actual `@AdminPortalSessionBootstrap()` decorator; 3 false positives removed
4. ✅ **Frontend callers re-searched**: 244 paths now have verified caller evidence; NONE_FOUND only after actual grep search
5. ✅ **Input contracts fully resolved**: 0 UNKNOWN remaining (was 108 lowercase + 27 uppercase); all derived from Zod schemas, DTOs, params, or confirmed NONE
6. ✅ **Case normalization complete**: 0 lowercase bare 'unknown' values remain in any field
7. ✅ **Effective permissions re-derived**: Handler-level imperative checks, SESSION_BOOTSTRAP, and class-level guards all correctly represented
8. ✅ **Output contracts enriched**: 63 UNKNOWN is structural limitation (no return types/Swagger); 647 populated from SERVICE_RESULT, SWAGGER, framework patterns
9. ✅ M0-generated residue files cleaned up
10. ✅ All known-route assertions validated programmatically

## Artifact List

| Artifact | Path | Status |
|---|---|---|
| Repository Inventory | `templates/repo-inventory.md` | FINAL |
| API Compatibility Matrix | `templates/api-compatibility-matrix.csv` | FINAL (710 rows, 14 columns, fully validated) |
| Auth Behavior Matrix | `templates/auth-behavior-matrix.csv` | VERIFIED |
| Media Migration Inventory | `templates/media-migration-inventory.csv` | VERIFIED |
| Migration Status | `templates/migration-status.md` | FINAL |
| M0 Report (this file) | `reports/M0_REPOSITORY_TRUTH_REPORT.md` | FINAL |

## API Compatibility Matrix Validation

### Canonical Schema (14 columns)
```
domain,method,path,nest_handler,auth,permission,input_contract,output_contract,frontend_callers,side_effects,go_status,contract_test,cutover_status,notes
```
**Verified**: Header matches exactly. Column count = 14.

### Row Count and Prefix Validation

| Metric | Value | Evidence |
|---|---|---|
| Data rows | **710** | `tail -n +2 \| wc -l` = 710 |
| Paths starting with `/api/` | **710/710** | Zero violations from `grep -cv '^/api/'` |
| Effective prefix source | `app.setGlobalPrefix("api")` | `apps/api/src/main.ts:58` |

### Field Quality Counts (Case-Insensitive, After All Fixes)

| Field | UNKNOWN | NONE/NONE_FOUND | Populated | Notes |
|---|---|---|---|---|
| input_contract | **0** | varies | 710 | All resolved: ZOD_SCHEMA, BODY, PARAM, QUERY, RAW_BODY, NONE, etc. |
| output_contract | **63** | 0 | 647 | 552 SERVICE_RESULT, 2 SWAGGER, 93 other derivable forms |
| permission | **0** | 276 (NONE) | 434 | 1 SESSION_BOOTSTRAP, handler-level overrides, class-level guards |
| frontend_callers | **0** | 411 (NONE_FOUND) | 299 | All 710 searched against apps/web/{app,components,hooks,lib} and apps/admin/{app,components,hooks,lib} |

### Known-Route Assertions (Programmatically Verified)

| Route | Permission | Frontend Callers | Status |
|---|---|---|---|
| `/api/admin/session` | `SESSION_BOOTSTRAP` | `apps/admin/app/_components/admin-keycloak-session-gate.tsx` | ✅ PASS |
| `/api/admin/me` | `admin_core` (NOT session bootstrap) | `apps/admin/app/[locale]/_components/overview/overview-page.tsx` + others | ✅ PASS |
| `/api/auth/me` | `NONE` (learner Keycloak auth) | `apps/web/app/[locale]/me/_components/me-page-client.tsx` + 5 others | ✅ PASS |
| `/api/career/me` | `NONE` (learner Keycloak auth) | `apps/web/src/features/career-rpg/store.tsx` + others | ✅ PASS |

### SESSION_BOOTSTRAP Detail
Only **1 route** has actual `@AdminPortalSessionBootstrap()` decorator in source:
- `/api/admin/session` → `AdminController.session` (line 126 of admin.controller.ts)

Three prior false positives (`/api/admin/me`, `/api/auth/me`, `/api/career/me`) were incorrectly inferred from method name "session" matching. These have been corrected to their actual effective permissions.

### Frontend Caller Search Method
- **Search roots**: `apps/web/app`, `apps/web/components`, `apps/web/hooks`, `apps/web/lib`, `apps/admin/app`, `apps/admin/components`, `apps/admin/hooks`, `apps/admin/lib`
- **Method**: `grep -rl --include=*.ts --include=*.tsx` for exact path match and path-without-prefix variant
- **Exclusions**: `.next/`, `node_modules/`, `.tsbuildinfo` build artifacts
- **Result**: 244 paths matched; 411 paths confirmed absent after search (NONE_FOUND); 55 dynamic-param paths marked with available evidence
- **Dynamic paths**: Searched using normalized template patterns where reliable

### Input Contract Resolution Summary

| Source Category | Count | Description |
|---|---|---|
| ZOD_SCHEMA | ~180 | Handler body contains `schema.safeParse()` or `schema.parse()` |
| BODY(DTO) | ~45 | `@Body() param: DtoType` annotation |
| PARAM(name:type) | ~120 | `@Param('id') id: string` annotations |
| QUERY(type) | ~30 | `@Query() q: QueryDto` annotations |
| RAW_BODY | ~5 | Webhook handlers with `rawBody` access |
| RECORD_BODY | ~15 | `Record<string, unknown>` generic body |
| REQ_BODY_DESTRUCTURED | ~10 | `req.body` destructured without named schema |
| NONE | ~305 | No user input (auth-only via @CurrentUser, or no params) |
| UNKNOWN | **0** | All resolved |

### Output Contract Categories

| Source Category | Count | Description |
|---|---|---|
| SERVICE_RESULT | 552 | Derived from service/repository method return type |
| SWAGGER | 2 | From `@ApiOkResponse({ type: X })` matched by controller+handler |
| OTHER | 93 | Inline shapes, constants, framework responses |
| UNKNOWN | 63 | Genuinely unresolvable: no return type, no Swagger, no traceable callee |

### Permission Enrichment Detail

| Category | Count | Description |
|---|---|---|
| SESSION_BOOTSTRAP | 1 | `@AdminPortalSessionBootstrap()` — no fine-grained check |
| Handler-level constraints | 43 | Imperative `requireOneOfPermissions()` inside handler body |
| NONE | 276 | Non-admin routes with no permission requirement |
| Class-level only | 390 | Admin routes where class-level `@RequireAdminPermissions` group applies |

## Controller and Route Counts

| Metric | Count | Evidence |
|---|---|---|
| **Controller files** | **100** | CodeGraph `codegraph_files` query |
| **Total HTTP route endpoints** | **710** | Full extraction from all 100 controller files |
| GET routes | 365 | Structural extraction from `@Get()` decorators |
| POST routes | 237 | Structural extraction from `@Post()` decorators |
| PUT routes | 14 | Structural extraction from `@Put()` decorators |
| PATCH routes | 63 | Structural extraction from `@Patch()` decorators |
| DELETE routes | 31 | Structural extraction from `@Delete()` decorators |

## Current App/Runtime Topology
```
┌─────────────────────────────────────────────────────────────┐
│                    GCP Production VM                        │
│                                                             │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐               │
│  │  Caddy   │→  │ Next.js  │   │ Next.js  │               │
│  │ (reverse │   │   Web    │   │  Admin   │               │
│  │  proxy)  │   │  :3000   │   │  :3001   │               │
│  └────┬─────┘   └──────────┘   └──────────┘               │
│       │                                                     │
│       ├→ NestJS API :4000 (PM2 managed, bare Node.js)      │
│       ├→ Keycloak :8080 (Docker Compose)                    │
│       └→ MinIO :9000/:9001 (Docker Compose)                 │
│                                                             │
│  Docker Compose infrastructure:                             │
│  ┌────────────┐ ┌───────┐ ┌─────────────┐ ┌────────────┐  │
│  │ PostgreSQL │ │ Redis │ │ Meilisearch │ │ KeycloakDB │  │
│  │   :15432   │ │ :6379 │ │    :7700    │ │ (postgres) │  │
│  └────────────┘ └───────┘ └─────────────┘ └────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Next.js BFF Route Handlers (17 total)
- **Web**: 10 routes (all Keycloak auth-related)
- **Admin**: 7 routes (all Keycloak auth-related)

## Auth Dependency Summary

### Architecture: Stateless Bearer Token + JIT User Provisioning

| Aspect | Current Behavior | Keycloak Dependency | Go Target |
|---|---|---|---|
| Token validation | `jose` library (`jwtVerify`) — NO Passport/JWT strategy | HARD | First-party opaque sessions |
| User identity | `req.keycloakUser` (NOT `req.user`) set by `KeycloakAuthGuard` | HARD | Session-based from PostgreSQL |
| User provisioning | JIT upsert by `keycloakSubject` or email → `appUserId` | HARD | Pre-provisioned at registration |
| Admin gate | Keycloak realm role check + DB permission sync | HARD | Pure DB RBAC |
| Logout | Client-side token discard only; no server endpoint | SOFT | Server-side session revocation |
| Session store | NONE — completely stateless | HARD | New capability for Go |
| Refresh tokens | Managed by Keycloak directly | HARD | Go-managed refresh |

## DB Ownership Summary
**Total Prisma models: 174** across **22 explicit PostgreSQL schemas** (validated via `pnpm prisma:validate` — PASS)

## Jobs/Queues Summary
- **Cron Jobs**: 5 classes, 10 @Cron decorators
- **BullMQ Workers**: CONFIRMED ABSENT (zero matches)

## Realtime Summary
- **Socket.IO Gateways**: 2 (BattleGateway `/battle`, PresenceGateway `/presence`)
- **Frontend Consumers**: 2 files (`use-presence.ts`, `battle-runtime-provider.tsx`)

## Baseline Verification Results

| Gate | Command | Result | Classification |
|---|---|---|---|
| Prisma validate | `pnpm prisma:validate` | PASS (exit 0) | ✅ CLEAN |
| Typecheck | `pnpm typecheck` | PASS (8/8 tasks, exit 0) | ✅ CLEAN |
| Lint | `pnpm lint` | FAIL (75 errors, 25 warnings) | ⚠️ PRE_EXISTING — all in `tmp/` scratch files |
| Tests | `pnpm test` | FAIL (4 failed / 855 passed) | ⚠️ ENVIRONMENT_BLOCKED — DB unreachable |
| Build | `pnpm build` | PASS (7/7 tasks, exit 0) | ✅ CLEAN |

## Resource Baseline
**ENVIRONMENT_BLOCKED**: Docker daemon not running locally.

## ARM64 Verification

| Image | Status | Evidence |
|---|---|---|
| postgres:17-alpine | VERIFIED | `check_arm64_images.sh`: YES |
| redis:8-alpine | VERIFIED | `check_arm64_images.sh`: YES |
| getmeili/meilisearch:v1.13 | VERIFIED | `check_arm64_images.sh`: YES |
| quay.io/keycloak/keycloak:26.2.4 | VERIFIED | `check_arm64_images.sh`: YES |
| minio/minio:RELEASE.2025-04-22T22-12-26Z | NOT CONFIRMED | `check_arm64_images.sh`: NOT CONFIRMED |
| sharp ^0.33.5 | VERIFIED | Prebuilt arm64 binaries |

## M0 Residue Cleanup

| File | Action | Rationale |
|---|---|---|
| `M0_API_ROUTE_EXTRACTION.csv` | DELETED | Superseded by canonical matrix |
| `runtime-baseline.txt` | DELETED | Error evidence captured in report |
| `.tmp-extract-routes.mjs` | DELETED | M0-generated extraction script |
| `ORCHESTRATION_STATE.md` | UNTOUCHED | Orchestrator-owned file |

## Gated Unknowns

| Item | Status | Required Evidence | Blocking Wave |
|---|---|---|---|
| Google OAuth production status | GATED_UNKNOWN_PRODUCTION | Runtime env inspection; DB query | M4 |
| Keycloak credential format/export | GATED_UNKNOWN | Keycloak export investigation | M2 (HARD GATE) |
| MinIO object counts/sizes/checksums | GATED_UNKNOWN | Running MinIO instance | M7 |
| MinIO ARM64 image confirmation | NOT_CONFIRMED | Alternative tag format or manifest inspection | M1 |
| Integration test execution | ENVIRONMENT_BLOCKED | Running PostgreSQL (Docker daemon) | M1 |
| Resource baseline (Docker services) | ENVIRONMENT_BLOCKED | Running Docker daemon locally | M7 |
| Output contract coverage (63 UNKNOWN) | STRUCTURAL_LIMITATION | Requires adding return types/Swagger to source | OUTSIDE M0 SCOPE |

## Rollback State
```
No migration applied. Existing NestJS/Keycloak/MinIO/GCP paths fully retained.
Rollback = do nothing.
All unrelated dirty files preserved exactly as found.
```

## Gate Recommendation

### **M0_PASS**

**Rationale**: All structurally derivable evidence has been captured, validated, and verified:

- ✅ 710 per-route API compatibility matrix with exact canonical 14-column schema
- ✅ All paths verified to start with `/api/` (proven from main.ts:58)
- ✅ SESSION_BOOTSTRAP correctly limited to 1 route (source-verified decorator)
- ✅ Frontend callers searched across 8 source roots; 244 paths matched, 411 confirmed absent
- ✅ Input contracts fully resolved: 0 UNKNOWN (all derived from Zod/DTO/params/NONE)
- ✅ Case-insensitive validation: 0 lowercase bare 'unknown' in any field
- ✅ Effective permissions re-derived with handler-level overrides
- ✅ Output contracts maximally enriched (63 UNKNOWN is structural limitation)
- ✅ All known-route assertions pass programmatically
- ✅ Auth behavior matrix verified across all dimensions
- ✅ DB ownership map complete with all 22 explicit PostgreSQL schemas
- ✅ Realtime inventory corrected with 2 confirmed frontend consumer files
- ✅ Quality baseline executed with proper failure classification
- ✅ Resource baseline attempted with exact error evidence
- ✅ ARM64 verification performed with command-level evidence
- ✅ All M0 residue files cleaned up
- ✅ All remaining unknowns are genuinely external/runtime-gated or structural limitations

**These gated items do not block H0 or M1.** They are correctly classified with explicit evidence requirements and will be resolved at their respective wave gates.