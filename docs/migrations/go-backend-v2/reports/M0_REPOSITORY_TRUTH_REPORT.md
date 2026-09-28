# M0 Repository Truth Report (Final)

## Identification
- **Starting HEAD**: `0fc4486f5cfd2edc4433359753be573605234006`
- **Prior M0 Commits**: `6b3a5a6`, `e6506f3`
- **Final HEAD**: (pending commit)
- **Branch**: `main`
- **Wave**: M0 — Repository truth / detailed inventory (FINAL REVISION)
- **Date**: 2026-09-28

## Revision Notes
This report supersedes all prior M0 commits. All blocking defects from two independent reviews have been addressed:
1. ✅ API compatibility matrix uses EXACT canonical 14-column schema
2. ✅ All 710 paths verified to start with `/api/` (proven via `app.setGlobalPrefix("api")` at main.ts:58)
3. ✅ Per-route fields populated to maximum structural derivability; UNKNOWN only where source truly lacks contract
4. ✅ M0-generated residue files cleaned up (M0_API_ROUTE_EXTRACTION.csv, runtime-baseline.txt removed)
5. ✅ Realtime consumers corrected: 2 frontend files confirmed
6. ✅ DB ownership: 22 explicit PostgreSQL schemas extracted
7. ✅ Quality baselines executed with proper classification
8. ✅ ARM64 verification with command-level evidence

## Artifact List
| Artifact | Path | Status |
|---|---|---|
| Repository Inventory | `templates/repo-inventory.md` | FINAL |
| API Compatibility Matrix | `templates/api-compatibility-matrix.csv` | FINAL (710 rows, 14 columns) |
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

### Field Quality Counts (Structural Derivability)
| Field | UNKNOWN | NONE/NONE_FOUND | Populated | Notes |
|---|---|---|---|---|
| input_contract | **0** | varies | 710 | All routes have structurally derivable input (params, body DTOs, or NONE) |
| output_contract | **556** | 0 | 154 | 556 routes lack explicit return types or @ApiResponse decorators in source; this is accurate to codebase, not parsing deficiency |
| permission | **0** | 283 (NONE) | 427 | All AdminRbacGuard routes resolved via ADMIN_ROUTE_GROUP_PERMISSIONS map; non-admin routes marked NONE |
| frontend_callers | **0** | 551 (NONE_FOUND) | 159 | All 710 routes searched against apps/web/src and apps/admin/src; NONE_FOUND means searched-and-absent, not skipped |

### Why output_contract Has 556 UNKNOWN
NestJS controllers in this codebase overwhelmingly omit return type annotations on handler methods. Only 4 routes had `@ApiResponse` decorators with explicit types. The remaining 150 populated entries come from explicit TypeScript return types on the handler method signature. This is a genuine codebase characteristic, not an extraction failure. Improving output contract coverage requires adding return type annotations or OpenAPI decorators to source — that is outside M0 scope (which is investigation-only).

## Controller and Route Counts
| Metric | Count | Evidence |
|---|---|---|
| **Controller files** | **100** | CodeGraph `codegraph_files` query |
| **Total HTTP route endpoints** | **710** | Full extraction from all 100 controller files; CSV has 711 lines (1 header + 710 data) |
| GET routes | 365 | Structural extraction from `@Get()` decorators |
| POST routes | 237 | Structural extraction from `@Post()` decorators |
| PUT routes | 14 | Structural extraction from `@Put()` decorators |
| PATCH routes | 63 | Structural extraction from `@Patch()` decorators |
| DELETE routes | 31 | Structural extraction from `@Delete()` decorators |

### Counting Method
- Each `@Get()`, `@Post()`, `@Put()`, `@Patch()`, `@Delete()` decorator in a `.controller.ts` file counts as one route
- WebSocket `@SubscribeMessage` handlers are NOT included (tracked separately in realtime inventory)
- Multi-controller files fully expanded
- No duplicate decorators, aliases, or test/debug routes detected
- Path composition rule: `/api/{@Controller_prefix}/{@Method_path}` proven by `app.setGlobalPrefix("api")` at main.ts:58

## Current App/Runtime Topology
```
┌─────────────────────────────────────────────────────────────┐
│ GCP Production VM                                           │
│                                                             │
│ ┌──────────┐   ┌──────────┐   ┌──────────┐                │
│ │ Caddy    │→  │ Next.js  │   │ Next.js  │                │
│ │ (reverse │   │ Web      │   │ Admin    │                │
│ │ proxy)   │   │ :3000    │   │ :3001    │                │
│ └────┬─────┘   └──────────┘   └──────────┘                │
│      │                                                      │
│      ├→ NestJS API :4000 (PM2 managed, bare Node.js)       │
│      ├→ Keycloak :8080 (Docker Compose)                     │
│      └→ MinIO :9000/:9001 (Docker Compose)                  │
│                                                             │
│ Docker Compose infrastructure:                              │
│ ┌────────────┐ ┌───────┐ ┌─────────────┐ ┌────────────┐   │
│ │ PostgreSQL │ │ Redis │ │ Meilisearch │ │ KeycloakDB │   │
│ │ :15432     │ │ :6379 │ │ :7700       │ │ (postgres) │   │
│ └────────────┘ └───────┘ └─────────────┘ └────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Next.js BFF Route Handlers (17 total)
- **Web**: 10 routes (all under `apps/web/app/api/auth/keycloak/` + auth callback/logout)
- **Admin**: 7 routes (all under `apps/admin/app/api/auth/keycloak/` + auth callback/logout)
- All 17 are Keycloak auth-related. No other Next.js API route handlers exist.

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
| Email verification | Delegated to Keycloak | HARD | Go-managed |
| Password reset | Delegated to Keycloak | HARD | Go-managed |

### Guards and Decorators Found
1. **`KeycloakAuthGuard`** — Primary learner auth; custom guard using `jose`, NOT `@nestjs/passport`
2. **`AdminRbacGuard`** — Admin auth; Keycloak realm role gate + DB permission check
3. **`@PublicRoute()`** — Bypasses auth on specific endpoints
4. **`@KeycloakAuthOptional()`** — Validates token if present, passes through if absent
5. **`@CurrentUser()`** — Injects `KeycloakAuthenticatedUser | undefined` from `req.keycloakUser`
6. **`EntitlementGuard`** — Monetization gate; must run AFTER `KeycloakAuthGuard`
7. **No `@Roles()`, `@Permissions()`, `JwtAuthGuard`, or Passport strategies exist**

## DB Ownership Summary
**Total Prisma models: 174** (validated via `pnpm prisma:validate` — PASS)

### PostgreSQL Schema Namespaces (EXPLICIT from schema.prisma line 8)
```
schemas = ["admin", "analytics", "assessment", "auth", "authz", "battle",
           "billing", "career", "content", "curriculum", "daily", "exercise",
           "gamification", "growth", "iam", "learning", "legal", "l10n",
           "media", "monetization", "ops", "profile"]
```
All 174 models have explicit `@@schema()` declarations. 22 schemas declared in datasource; 20 unique schemas found in model declarations.

## Jobs/Queues Summary
### Cron Jobs (5 classes, 10 @Cron decorators)
| Job | Schedule | Timezone | Handler | Dependencies |
|---|---|---|---|---|
| ComebackExperienceCron | `0 10 * * *` | Asia/Ho_Chi_Minh | handleDailyCheck | ComebackExperienceService |
| MagazineGenerationCron | `30 5 * * *` | Asia/Ho_Chi_Minh | handleDailyGeneration | MagazineGenerationService (4 kinds) |
| LotoAutopilotCron | 3 crons + @Timeout(30s) | Asia/Tokyo | handleLoto6/7, catchups | LotoLabService; gated by LOTO_AUTOPILOT_ENABLED |
| PushNotificationCron | `0 7 * * *` | Asia/Ho_Chi_Minh | handleDailyKanjiPush | PushNotificationService |
| SmartNotificationCron | 4 crons | Asia/Ho_Chi_Minh | pet/streak/study handlers | SmartNotificationService |

### BullMQ Workers
**CONFIRMED ABSENT**: Zero matches for `BullModule`, `@Processor`, `@OnProcess`, or `Queue` imports. M10 scope is cron migration only.

## Realtime Summary (CORRECTED)
### Socket.IO Gateways (2 found)
| Gateway | Namespace | Events | Auth | Frontend Consumers |
|---|---|---|---|---|
| BattleGateway | `/battle` | 9 @SubscribeMessage handlers | NONE | 1 file |
| PresenceGateway | `/presence` | 2 handlers + 4 emitted events | Bearer token via handshake.auth.token | 1 file |

### Frontend Socket.IO Consumers (2 files)
1. **`apps/web/hooks/use-presence.ts`** — `/presence` namespace, token auth, heartbeat every 60s, listens for `battle:user_challenge_received`
2. **`apps/web/app/[locale]/battle/_components/battle-runtime-provider.tsx`** — `/battle` namespace, no auth, 9 emit events, 20 listen events, pending-action queue pattern

## Baseline Verification Results
| Gate | Command | Result | Classification |
|---|---|---|---|
| Prisma validate | `pnpm prisma:validate` | PASS (exit 0) | ✅ CLEAN |
| Typecheck | `pnpm typecheck` | PASS (8/8 tasks, exit 0) | ✅ CLEAN |
| Lint | `pnpm lint` | FAIL (75 errors, 25 warnings) | ⚠️ PRE_EXISTING — all in `tmp/` scratch files |
| Tests | `pnpm test` | FAIL (4 failed / 855 passed) | ⚠️ ENVIRONMENT_BLOCKED — DB unreachable (Docker not running) |
| Build | `pnpm build` | PASS (7/7 tasks, exit 0) | ✅ CLEAN |

## Resource Baseline
**ENVIRONMENT_BLOCKED**: Docker daemon not running locally.
- Error: `failed to connect to the docker API at unix:///Users/thanhnguyen/.docker/run/docker.sock; connect: no such file or directory`
- `docker compose version`: 5.5.0 (CLI installed but daemon unavailable)

## ARM64 Verification (Command-Level Evidence)
Command: `bash docs/migrations/go-backend-v2/scripts/check_arm64_images.sh <image>`
| Image | ARM64 Status | Evidence |
|---|---|---|
| postgres:17-alpine | VERIFIED | Script output: "ARM64: YES" |
| redis:8-alpine | VERIFIED | Script output: "ARM64: YES" |
| getmeili/meilisearch:v1.13 | VERIFIED | Script output: "ARM64: YES" |
| quay.io/keycloak/keycloak:26.2.4 | VERIFIED | Script output: "ARM64: YES" |
| minio/minio:RELEASE.2025-04-22T22-12-26Z | NOT CONFIRMED | Script output: "ARM64: NOT CONFIRMED" |
| sharp ^0.33.5 | VERIFIED | Prebuilt arm64 binaries shipped with package |

## M0 Residue Cleanup
| File | Action | Rationale |
|---|---|---|
| `docs/migrations/go-backend-v2/reports/M0_API_ROUTE_EXTRACTION.csv` | DELETED | Superseded by canonical matrix in templates/ |
| `runtime-baseline.txt` | DELETED | Empty/incomplete due to Docker unavailability; error evidence captured in report |
| `ORCHESTRATION_STATE.md` | UNTOUCHED | Orchestrator-owned file; not M0 artifact |

## Gated Unknowns
| Item | Status | Required Evidence | Blocking Wave |
|---|---|---|---|
| Google OAuth production status | GATED_UNKNOWN_PRODUCTION | Runtime env inspection; DB identity provider count | M4 |
| Keycloak credential format/export | GATED_UNKNOWN | Keycloak export investigation | M2 (HARD GATE) |
| MinIO object counts/sizes/checksums | GATED_UNKNOWN | Running MinIO instance with bucket access | M7 |
| MinIO ARM64 image confirmation | NOT_CONFIRMED | Alternative tag format or manual manifest inspection | M1 |
| Integration test execution | ENVIRONMENT_BLOCKED | Running PostgreSQL (Docker daemon) | M1 |
| Resource baseline (Docker services) | ENVIRONMENT_BLOCKED | Running Docker daemon locally | M7 |
| Output contract coverage (556 UNKNOWN) | STRUCTURAL_LIMITATION | Requires adding return types/@ApiResponse to source | OUTSIDE M0 SCOPE |

## H0 Inputs
1. **AGENTS.md / AI_CONTEXT.md BullMQ reference**: States "Redis/BullMQ handles background jobs" but no BullMQ exists. Correct to "cron-based scheduled jobs."
2. **docs/17_realtime_migration.md consumer count**: Claims "7+ components" but actual count is 2 files. Update to match repo evidence.
3. **Deployment docs**: GCP deployment is PM2-based, not containerized. Ensure docs reflect actual topology.
4. **Google OAuth docs**: Clarify disabled when Keycloak active.
5. **Auth architecture docs**: Clarify custom `jose`-based guard, NOT Passport/JWT strategy.

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
- ✅ Per-route fields maximally populated; UNKNOWN only where source truly lacks contract
- ✅ Auth behavior matrix verified across all dimensions
- ✅ DB ownership map complete with all 22 explicit PostgreSQL schemas
- ✅ Realtime inventory corrected with 2 confirmed frontend consumer files
- ✅ Quality baseline executed with proper failure classification
- ✅ Resource baseline attempted with exact error evidence
- ✅ ARM64 verification performed with command-level evidence
- ✅ M0 residue files cleaned up
- ✅ All remaining unknowns are genuinely external/runtime-gated or structural limitations

**These gated items do not block H0 or M1.** They are correctly classified with explicit evidence requirements and will be resolved at their respective wave gates.

## Next Steps
1. **H0**: Documentation hygiene classification and corrections
2. **M1**: Go foundation + deployment foundations
3. **M2**: Keycloak credential investigation gate (HARD GATE)
4. **M4**: Google OAuth migrate/retire decision
5. **M7**: MinIO object reconciliation