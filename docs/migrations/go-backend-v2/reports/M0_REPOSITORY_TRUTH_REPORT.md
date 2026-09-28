# M0 Repository Truth Report (Contract-Quality Final)

## Identification
- **Starting HEAD**: `0fc4486f5cfd2edc4433359753be573605234006`
- **Prior M0 Commits**: `6b3a5a6`, `e6506f3`, `47a7d13`
- **Final HEAD**: (pending commit)
- **Branch**: `main`
- **Wave**: M0 — Repository truth / detailed inventory (CONTRACT-QUALITY FINAL)
- **Date**: 2026-09-28

## Revision Notes
This report supersedes all prior M0 commits. All blocking defects from three independent reviews have been addressed:
1. ✅ API compatibility matrix uses exact canonical 14-column schema
2. ✅ All 710 paths verified to start with `/api/` (proven via `app.setGlobalPrefix("api")` at main.ts:58)
3. ✅ **Effective per-route permissions** re-derived: SESSION_BOOTSTRAP, method-level overrides, imperative `requireOneOfPermissions()` checks captured
4. ✅ **Output contracts enriched**: 552 SERVICE_RESULT + 2 SWAGGER + framework patterns; only 63 genuinely unresolvable remain UNKNOWN
5. ✅ M0-generated residue files cleaned up (M0_API_ROUTE_EXTRACTION.csv, runtime-baseline.txt, .tmp-extract-routes.mjs removed)
6. ✅ Realtime consumers corrected: 2 frontend files confirmed
7. ✅ DB ownership: 22 explicit PostgreSQL schemas extracted
8. ✅ Quality baselines executed with proper classification
9. ✅ ARM64 verification with command-level evidence

## Artifact List
| Artifact | Path | Status |
|---|---|---|
| Repository Inventory | `templates/repo-inventory.md` | FINAL |
| API Compatibility Matrix | `templates/api-compatibility-matrix.csv` | FINAL (710 rows, 14 columns, enriched) |
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
| Data rows | **710** | `tail -n +2 | wc -l` = 710 |
| Paths starting with `/api/` | **710/710** | Zero violations from `grep -cv '^/api/'` |
| Effective prefix source | `app.setGlobalPrefix("api")` | `apps/api/src/main.ts:58` |

### Field Quality Counts (After Enrichment)
| Field | UNKNOWN | NONE/NONE_FOUND | Populated | Notes |
|---|---|---|---|---|
| input_contract | **0** | varies | 710 | All routes have structurally derivable input |
| output_contract | **63** | 0 | 647 | 552 SERVICE_RESULT, 2 SWAGGER, 93 other derivable forms |
| permission | **0** | 276 (NONE) | 434 | 4 SESSION_BOOTSTRAP, 43 handler-level constraints, rest class-level |
| frontend_callers | **0** | 700 (NONE_FOUND) | 10 | All 710 routes searched against apps/web/src and apps/admin/src |

### Permission Enrichment Detail
| Category | Count | Description |
|---|---|---|
| SESSION_BOOTSTRAP | 4 | Routes using `@AdminPortalSessionBootstrap()` — no fine-grained permission check |
| Handler-level constraints | 43 | Imperative `requireOneOfPermissions()` calls inside handler bodies that override or refine class-level guard |
| NONE | 276 | Non-admin routes with no permission requirement |
| Class-level only | 387 | Admin routes where class-level `@RequireAdminPermissions` group is the effective contract |

**Example corrections applied:**
- `AdminController.session` → `SESSION_BOOTSTRAP` (was broad admin_core list)
- `AdminController.iamRoles` → `iam.manage|viewer.audit` (handler-level override)
- `AdminController.moduleContracts` → `iam.manage|admin.content.read|supportUserRead|supportUserWrite|supportUserLegacy` (imperative check)

### Output Contract Enrichment Detail
| Source Category | Count | Description |
|---|---|---|
| SERVICE_RESULT | 552 | Derived from service/repository method return type signatures |
| SWAGGER | 2 | From `@ApiOkResponse({ type: X })` decorators matched by controller+handler |
| OTHER | 93 | Inline shapes, constants, framework responses derived from handler body |
| UNKNOWN | 63 | Genuinely unresolvable: no return type, no Swagger, no traceable service call |

**Why 63 remain UNKNOWN**: These handlers have no explicit return type annotation, no Swagger decorator, and return expressions that cannot be statically resolved to a named type or service method (e.g., complex conditional returns, dynamic object construction without stable shape). This is a genuine structural limitation, not an extraction deficiency.

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
│  ┌──────────┐   ┌──────────┐   ┌──────────┐                │
│  │  Caddy   │→  │ Next.js  │   │ Next.js  │                │
│  │ (reverse │   │   Web    │   │  Admin   │                │
│  │  proxy)  │   │  :3000   │   │  :3001   │                │
│  └────┬─────┘   └──────────┘   └──────────┘                │
│       │                                                     │
│       ├→ NestJS API :4000 (PM2 managed, bare Node.js)      │
│       ├→ Keycloak :8080 (Docker Compose)                    │
│       └→ MinIO :9000/:9001 (Docker Compose)                 │
│                                                             │
│  Docker Compose infrastructure:                             │
│  ┌────────────┐ ┌───────┐ ┌─────────────┐ ┌────────────┐  │
│  │ PostgreSQL │ │ Redis │ │ Meilisearch │ │ KeycloakDB │  │
│  │  :15432    │ │ :6379 │ │   :7700     │ │ (postgres) │  │
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
**Rationale**: All structurally derivable evidence has been captured and verified:
- ✅ 710 per-route API compatibility matrix with exact canonical 14-column schema
- ✅ All paths verified to start with `/api/` (proven from main.ts:58)
- ✅ Effective per-route permissions re-derived (SESSION_BOOTSTRAP, handler-level overrides, imperative checks)
- ✅ Output contracts maximally enriched (63 UNKNOWN is structural limitation, not extraction failure)
- ✅ Auth behavior matrix verified across all dimensions
- ✅ DB ownership map complete with all 22 explicit PostgreSQL schemas
- ✅ Realtime inventory corrected with 2 confirmed frontend consumer files
- ✅ Quality baseline executed with proper failure classification
- ✅ Resource baseline attempted with exact error evidence
- ✅ ARM64 verification performed with command-level evidence
- ✅ All M0 residue files cleaned up
- ✅ All remaining unknowns are genuinely external/runtime-gated or structural limitations

**These gated items do not block H0 or M1.** They are correctly classified with explicit evidence requirements and will be resolved at their respective wave gates.