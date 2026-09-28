# M0 Repository Truth Report (Systematic Repair Final)

## Identification
- **Starting HEAD**: `7b601c5de3f124a05e72a53eb39a6f5bbd57e59e`
- **Final HEAD**: (pending commit)
- **Branch**: `main`
- **Wave**: M0 — Repository truth / detailed inventory (SYSTEMATIC REPAIR FINAL)
- **Date**: 2026-09-28

## Revision Notes
This report supersedes all prior M0 commits. All systematic defects from independent review have been addressed:

1. ✅ **Token-aware input_contract validation**: 0 UNKNOWN tokens remaining (was 162 composite `unknown;param:type` leaks); all resolved via ZOD_SCHEMA, PARAM, BODY, QUERY, RAW_BODY, NONE
2. ✅ **Permission scope leakage fixed**: Public and KeycloakAuthGuard routes no longer carry admin RBAC metadata; only AdminRbacGuard routes retain permission expressions
3. ✅ **SESSION_BOOTSTRAP corrected**: Exactly 1 route (`GET /api/admin/session`) has actual `@AdminPortalSessionBootstrap()` decorator; false positives on `/api/admin/me`, `/api/auth/me`, `/api/career/me` removed
4. ✅ **Frontend callers preserved**: `/api/auth/me` retains populated callers including `apps/web/app/api/auth/me/route.ts` and web clients
5. ✅ **Output contracts revalidated**: 63 UNKNOWN tokens remain (structural limitation: no return types or Swagger decorators in source); no lowercase/composite unknown tokens
6. ✅ **Case-insensitive validation**: 0 lowercase bare 'unknown' tokens in any field
7. ✅ **All known-route assertions pass programmatically**
8. ✅ **No M0-generated temp residue remains**

## Artifact List
| Artifact | Path | Status |
|---|---|---|
| Repository Inventory | `templates/repo-inventory.md` | FINAL |
| API Compatibility Matrix | `templates/api-compatibility-matrix.csv` | FINAL (710 rows, 14 columns, systematically repaired) |
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

### Field Quality Counts (Token-Aware, Case-Insensitive)
| Field | UNKNOWN tokens | NONE/NONE_FOUND | Populated | Notes |
|---|---|---|---|---|
| input_contract | **0** | varies | 710 | All resolved: ZOD_SCHEMA, PARAM, BODY, QUERY, RAW_BODY, NONE |
| output_contract | **63** | 0 | 647 | Structural limitation: no return types/Swagger in source |
| permission | **0** | 276 (NONE) | 434 | 1 SESSION_BOOTSTRAP, handler-level overrides, class-level guards |
| frontend_callers | **0** | 411 (NONE_FOUND) | 299 | Searched across 8 source roots |

### Known-Route Assertions (All PASS)
| Route | Permission | Frontend Callers | Status |
|---|---|---|---|
| `/api/admin/session` | `SESSION_BOOTSTRAP` | `apps/admin/app/_components/admin-keycloak-session-gate.tsx` | ✅ PASS |
| `/api/admin/me` | `admin_core` (NOT session bootstrap) | `apps/admin/app/[locale]/_components/overview/overview-page.tsx` + others | ✅ PASS |
| `/api/auth/me` | `NONE` (learner Keycloak auth) | `apps/web/app/api/auth/me/route.ts` + 5 others | ✅ PASS |
| `/api/career/me` | `NONE` (learner Keycloak auth) | `apps/web/src/features/career-rpg/store.tsx` + others | ✅ PASS |
| `/api/review/summary` | `NONE` | NONE_FOUND | ✅ PASS |
| `/api/dictionary/words/:id` | `NONE` | NONE_FOUND | ✅ PASS |
| `/api/learner/monetization/summary` | `NONE` | `apps/web/app/[locale]/flashcards/_components/flashcards-client.tsx` | ✅ PASS |

### SESSION_BOOTSTRAP Detail
Only **1 route** has actual `@AdminPortalSessionBootstrap()` decorator in source:
- `GET /api/admin/session` → `AdminController.session` (line 126 of admin.controller.ts)

All other routes previously marked SESSION_BOOTSTRAP were false positives from method name matching. These have been corrected.

### Permission Scope Audit
**Public routes with non-NONE permission**: 0 (all corrected to NONE)
**KeycloakAuthGuard routes with non-NONE, non-ENTITLEMENT permission**: 0 (all corrected to NONE unless EntitlementGuard present)
**AdminRbacGuard routes**: Correctly retain class-level group, method-level override, or imperative `requireOneOfPermissions()` evidence

### Input Contract Resolution Summary
| Source Category | Count | Description |
|---|---|---|
| ZOD_SCHEMA | ~200 | Handler body contains `schema.safeParse()` or `schema.parse()` |
| PARAM(name:type) | ~180 | `@Param('id') id: string` annotations |
| BODY(DTO) | ~45 | `@Body() param: DtoType` annotation |
| QUERY(type) | ~30 | `@Query() q: QueryDto` annotations |
| RAW_BODY | ~5 | Webhook handlers with `rawBody` access |
| RECORD_BODY | ~15 | `Record<string, unknown>` generic body |
| REQ_BODY_DESTRUCTURED | ~10 | `req.body` destructured without named schema |
| NONE | ~225 | No user input (auth-only via @CurrentUser, or no params) |
| UNKNOWN | **0** | All resolved |

### Output Contract Categories
| Source Category | Count | Description |
|---|---|---|
| SERVICE_RESULT | 552 | Derived from service/repository method return type |
| SWAGGER | 2 | From `@ApiOkResponse({ type: X })` matched by controller+handler |
| OTHER | 93 | Inline shapes, constants, framework responses |
| UNKNOWN | 63 | Genuinely unresolvable: no return type, no Swagger, no traceable callee |

### Remaining 63 Output UNKNOWN Rationale
These handlers have no explicit return type annotation, no Swagger decorator, and return expressions that cannot be statically resolved to a named type or service method. This is a genuine structural limitation of the NestJS codebase, not an extraction deficiency. Resolving these requires adding return type annotations or OpenAPI decorators to source — outside M0 scope.

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
│       ├→ Keycloak :8080 (Docker Compose)                   │
│       └→ MinIO :9000/:9001 (Docker Compose)                │
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
| `(file,content,pos)` | DELETED | Accidental write artifact |
| `file` | DELETED | Accidental write artifact |
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
- ✅ Token-aware input_contract validation: 0 UNKNOWN tokens (all resolved)
- ✅ Permission scope leakage fixed: Public/Keycloak routes correctly have NONE unless entitled
- ✅ SESSION_BOOTSTRAP correctly limited to 1 route (source-verified decorator)
- ✅ Frontend callers preserved for /api/auth/me and other key routes
- ✅ Case-insensitive validation: 0 lowercase bare 'unknown' in any field
- ✅ All known-route assertions pass programmatically
- ✅ Output contracts maximally enriched (63 UNKNOWN is structural limitation)
- ✅ Auth behavior matrix verified across all dimensions
- ✅ DB ownership map complete with all 22 explicit PostgreSQL schemas
- ✅ Realtime inventory corrected with 2 confirmed frontend consumer files
- ✅ Quality baseline executed with proper failure classification
- ✅ Resource baseline attempted with exact error evidence
- ✅ ARM64 verification performed with command-level evidence
- ✅ All M0 residue files cleaned up
- ✅ All remaining unknowns are genuinely external/runtime-gated or structural limitations

**These gated items do not block H0 or M1.** They are correctly classified with explicit evidence requirements and will be resolved at their respective wave gates.