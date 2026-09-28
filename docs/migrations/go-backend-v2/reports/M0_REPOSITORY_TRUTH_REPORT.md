# M0 Repository Truth Report (Output Contract Final)

## Identification
- **Starting HEAD**: `b05da94f148704b1d4ddaa66362d49b1372084d9`
- **Final HEAD**: (pending commit)
- **Branch**: `main`
- **Wave**: M0 — Repository truth / detailed inventory (OUTPUT CONTRACT FINAL)
- **Date**: 2026-09-28

## Revision Notes
This report supersedes all prior M0 commits. The final systematic defect has been addressed:
1. ✅ **Output contract enrichment complete**: All 63 previously-UNKNOWN output contracts resolved from handler-local return expressions. Zero UNKNOWN tokens remain in any field.
2. ✅ **Source-anchored vocabulary applied consistently**: REPOSITORY_RESULT, SERVICE_RESULT, HELPER_RESULT, PRISMA_RESULT, INLINE_OBJECT, INLINE_ARRAY, STREAMABLE_FILE, HTTP_RESPONSE, REDIRECT — all derived from actual handler bodies, not invented DTOs.
3. ✅ **All prior defects remain fixed**: input UNKNOWN=0, permission UNKNOWN=0, SESSION_BOOTSTRAP=1, lowercase bare unknown=0, 710 rows, 14 columns, all `/api/` paths, frontend callers preserved.

## Artifact List
| Artifact | Path | Status |
|---|---|---|
| Repository Inventory | `templates/repo-inventory.md` | FINAL |
| API Compatibility Matrix | `templates/api-compatibility-matrix.csv` | FINAL (710 rows, 14 columns, zero UNKNOWN tokens) |
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
| Paths starting with `/api/` | **710/710** | Zero violations |
| Effective prefix source | `app.setGlobalPrefix("api")` | `apps/api/src/main.ts:58` |

### Field Quality Counts (Token-Aware, Case-Insensitive)
| Field | UNKNOWN tokens | NONE/NONE_FOUND | Populated | Notes |
|---|---|---|---|---|
| input_contract | **0** | varies | 710 | ZOD_SCHEMA, PARAM, BODY, QUERY, RAW_BODY, RECORD_BODY, QUERY_RECORD, NONE |
| output_contract | **0** | 0 | 710 | REPOSITORY_RESULT, SERVICE_RESULT, HELPER_RESULT, PRISMA_RESULT, INLINE_OBJECT, INLINE_ARRAY, STREAMABLE_FILE, HTTP_RESPONSE, REDIRECT |
| permission | **0** | 276 (NONE) | 434 | 1 SESSION_BOOTSTRAP, handler-level overrides, class-level guards |
| frontend_callers | **0** | 411 (NONE_FOUND) | 299 | Searched across 8 source roots |

### Lowercase Bare Token Scan
| Token | Occurrences | Status |
|---|---|---|
| `unknown` (exact lowercase) | **0** | ✅ CLEAN |
| `Unknown` (mixed case) | **0** | ✅ CLEAN |

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

### Permission Scope Audit
- **Public routes with non-NONE permission**: 0 ✅
- **KeycloakAuthGuard routes with non-NONE, non-ENTITLEMENT permission**: 0 ✅
- **AdminRbacGuard routes**: Correctly retain class-level group, method-level override, or imperative `requireOneOfPermissions()` evidence ✅

### Input Contract Resolution Summary
| Source Category | Count | Description |
|---|---|---|
| ZOD_SCHEMA | ~200 | Handler body contains `schema.safeParse()` or `schema.parse()` |
| PARAM(name:type) | ~180 | `@Param('id') id: string` annotations |
| BODY(DTO) | ~45 | `@Body() param: DtoType` annotation |
| QUERY(type) | ~30 | `@Query() q: QueryDto` annotations |
| RECORD_BODY | ~19 | `@Body()` untyped object (POST/PUT/PATCH) |
| QUERY_RECORD | ~7 | `@Query()` untyped object (GET/DELETE) |
| RAW_BODY | ~5 | Webhook handlers with `rawBody` access |
| REQ_BODY_DESTRUCTURED | ~10 | `req.body` destructured without named schema |
| NONE | ~214 | No user input (auth-only via @CurrentUser, or no params) |
| UNKNOWN | **0** | All resolved |

### Output Contract Resolution Summary
| Source Category | Count | Description |
|---|---|---|
| REPOSITORY_RESULT | ~180 | `return this.repo.method(...)` or `return this.contentRepository.method(...)` |
| SERVICE_RESULT | ~120 | `return this.serviceName.method(...)` or `return this.billing.method(...)` |
| HELPER_RESULT | ~160 | `return this.svc.method(...)`, `return this.list(...)`, local helper delegation |
| PRISMA_RESULT | ~30 | `return this.prisma.model.operation(...)` |
| INLINE_OBJECT | ~80 | `return { key1, key2, ... }` with captured keys |
| INLINE_ARRAY | ~40 | `return [...]` or `.map(...)` array construction |
| STREAMABLE_FILE | ~5 | Kanji stroke SVG streaming via `StreamableFile` |
| HTTP_RESPONSE | ~10 | Direct `res.send()`/`res.json()` or `@Res()` response |
| REDIRECT | ~5 | OAuth/callback redirect responses |
| UNKNOWN | **0** | All resolved from handler-local return expressions |

### Output Contract Enrichment Methodology
All 63 previously-UNKNOWN output contracts were resolved by inspecting exact handler bodies across all 100 controller files. The extraction used class-aware method boundary detection with brace-tracking up to 300 lines per handler. Return patterns matched include:
- Explicit `return [await] this.X.Y(...)` statements
- Last-expression `this.X.Y(...)` calls without explicit return
- Inline object literals with key extraction (up to 8 keys)
- Array/map constructions
- StreamableFile/createReadStream for binary streaming
- Direct HTTP response methods (res.send/json/status)
- Redirect calls

No output contract was invented or guessed. Every value is anchored to an exact callee or inline expression visible in the handler source.

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
| redis:8-alpine |