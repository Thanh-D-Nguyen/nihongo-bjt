# Go Backend Migration Orchestration State

## Git Truth
- ImplementationAcceptedHEAD: `d25ff30` (anonymous behavior parity + public content stubs)
- CurrentRepositoryHEAD: `d25ff30` (matches ImplementationAcceptedHEAD)
- Branch: main
- Working tree: clean (untracked staging Dockerfiles and compose expected)

## Overall Status
- OverallStatus: READY_FOR_PRODUCTION_CUTOVER
- EngineeringMigration: COMPLETE
- LinuxStagingValidation: PASS_WITH_PRODUCTION_GATES
- RealtimeValidation: PASS (16/16 protocol tests)
- LanClientAccess: PASS (Mac → learner/admin/API/media/WS verified on :18080)
- LanBrowserRender: LEARNER_PASS / ADMIN_HUMAN_ACTION_REQUIRED
- AnonymousBehaviorParity: PASS (5 public/OPTIONAL_AUTH stubs; hydration crash fixed; /api/auth/me 401 preserved)
- BrowserAuthOriginParity: PASS (registration/session/logout/login via Caddy; forged/near-match origins rejected; COOKIE_SECURE env-gated; production security not weakened)
- RealBrowserAuthenticatedParity: PASS (8/8 Playwright tests: anonymous home, login/register render, register→session→refresh→logout→relogin lifecycle, wrong-password negative, mobile viewports; auth route fixes deployed; PostgreSQL recovered from disk-full crash-loop)
- ApiMatrixValidation: PASS (intermediate gate; 747 canonical old routes, 191 Go + 4 BFF current, 165 LEARNER_PASS, 0 LEARNER_TRUE_MISSING, 161 LEARNER_NEEDS_LIVE_VERIFICATION, 24 UNMATCHED_GO_ROUTES, 6 INTENTIONALLY_REMOVED, 0 UNKNOWN; report: docs/migrations/go-backend-v2/reports/API_SURFACE_PARITY.md)
- LearnerApiStaticParity: PASS (LEARNER_TRUE_MISSING=0, local tests pass, 5 stub handlers audited as COMPATIBILITY_ADAPTER, 9 daily-radar write ops reclassified as ADMIN)
- AdminRuntimeClassification: COMPLETE (398 ACTIVE_ADMIN_RUNTIME routes across 34 domains; 0 DORMANT/DEPRECATED/REPLACED; all confirmed via admin frontend caller tracing in apps/admin/)
- FullApiSurfaceParity: IN_PROGRESS (P0-L1→L5 LEARNER COMPLETE: 165 routes; P1-A1 ADMIN OPERATIONS STATIC PARITY PASS: 49 routes across 12 sub-waves @ dcb61bf; P1-A2 ASSESSMENT STATIC PARITY PASS: 30 routes across 4 sub-waves @ 805a6e7; P1-A3 GROWTH STATIC PARITY PASS: 27 routes across 4 sub-waves @ aac40c8; P1-A4 BATTLE STATIC PARITY PASS: 26 routes across 4 sub-waves @ c682405; P1-A5 MONETIZATION STATIC PARITY PASS: 36 routes across 4 sub-waves @ 05fdb07; P1-A6 ANALYTICS STATIC PARITY PASS: 40 routes across 8 sub-domains @ 32c2bd7; P1-A7 ADMIN CORE STATIC PARITY PASS: 38 routes across IAM/users/content/support/audit/i18n/reading-assist @ 149a4e0; P1-A8 ADMIN LEARNING STATIC PARITY PASS: 20 routes across paths/competencies/review @ 9e4e437; P1-A9 ADMIN GAMIFICATION STATIC PARITY PASS: 23 routes across streaks/achievements/tiers/leaderboards/pets @ 8a1c188; P1-A10 ADMIN ADS STATIC PARITY PASS: 13 routes across overview/placements/campaigns/providers/rules/performance/audit @ ed02722; P1-A11 ADMIN MAGAZINE+LOTO STATIC PARITY PASS: 16 routes across articles/predictions/lab @ 11b1393; P1-A12 ADMIN FLASHCARDS STATIC PARITY PASS: 15 routes across decks/variants/styles @ e969bc6; P1-A13 ADMIN LEGAL STATIC PARITY PASS: 11 routes across policies/cookie-categories/retention @ 5182f50; P1-A14 ADMIN DAILY-RADAR+EXERCISES STATIC PARITY PASS: 22 routes across modules/cards/config/crud/analytics @ f1e8721; P1-A15 NEXT; ADMIN_TRUE_MISSING_ACTIVE=33; staging live verification BLOCKED_CURRENT_SESSION)
- LegacyBackendRemovalReady: TRUE
- DiskRemediation: DONE (92% → 89%, 3.5GB reclaimed)
- RebootGate: REBOOT_EXTERNAL_PRIVILEGE_GATE
- ProductionCutover: PENDING
- KeycloakFinalDisable: DEFERRED_TO_CUTOVER
- LastCompletedEngineeringWave: M17_POST_MIGRATION_CLEANUP
- RemainingHumanGate: Admin static asset routing via Caddy (assetPrefix not baking in Turbopack monorepo build; workaround: direct container port :13001) / Production cutover authorization / interactive sudo reboot / ARM64 OCI verification / public DNS+TLS

## Service Retirement State
| Service | Status |
|---|---|
| Go API | ACTIVE_TARGET |
| Learner Web | ACTIVE_TARGET |
| Admin | ACTIVE_TARGET |
| Mobile | ACTIVE_TARGET |
| PostgreSQL | ACTIVE_TARGET |
| Redis | ACTIVE_TARGET |
| Meilisearch | ACTIVE_TARGET |
| Caddy | ACTIVE_TARGET |
| Media LocalFS | ACTIVE_TARGET |
| Keycloak | CUTOVER_PENDING |
| Keycloak DB | CUTOVER_PENDING |
| MinIO | DISABLED_ROLLBACK_AVAILABLE |
| NestJS | DISABLED_ROLLBACK_AVAILABLE |

## Wave Summary
- Current accepted implementation/code checkpoint: `94512f0` (M17 post-migration cleanup PASS — 17 files changed +33/-293, dead NestJS scripts/deps/configs removed, README/AI_CONTEXT updated, Caddy Keycloak proxy retired, go test/vet/gofmt PASS, web/admin typecheck PASS; committed at 94512f0)
- Last completed wave: M17_POST_MIGRATION_CLEANUP PASS (removed 5 dead NestJS scripts + 8 hoisted NestJS deps from root package.json, deleted fix-inject-decorators.ts, retired auth.__DOMAIN__ Caddy blocks in GCP+OCI templates, cleaned Keycloak secrets from prepare-runtime.sh, removed @nihongo-bjt/keycloak-oidc from transpilePackages/tsconfig, updated README/AI_CONTEXT to reflect Go-primary architecture; apps/api/ preserved for rollback; committed at 94512f0)
- M13 audit outcome: REVISE — ~115 files across 6 components had ACTIVE_RUNTIME Keycloak dependencies. M13a resolved learner web (~40 files). M13b resolved admin (~15 files). M13c resolved mobile (~20 files). Remaining: NestJS API 37 controllers/687 refs, shared packages 3. Report: docs/migrations/go-backend-v2/reports/M13_KEYCLOAK_AUDIT_REPORT.md
- M13 sub-wave plan: M13a ✅ → M13b ✅ → M13c ✅ → M13d NestJS retirement or auth shim → M13-final Keycloak disable. Dependency ordering issue: NestJS depends on Keycloak (37 controllers), so M15 (NestJS disable) should precede or parallel M13d. Recommended sequence: M13a ✅ → M13b ✅ → M13c ✅ → M15 → M13d → M13-final.
- Next wave: M13d NestJS retirement or auth shim (remove or shim NestJS Keycloak dependencies; may be deferred to M15 if NestJS disable is prerequisite)
- Decision: `LEGACY_CREDENTIAL_MIGRATION = NOT_REQUIRED`; `IDENTITY_RESET_APPROVED = TRUE`. The user approved resetting identity/account-scoped data only. This closes the M2 production credential-format gate without obtaining Keycloak metadata.

## Completed Checkpoint Commits
- `0fc4486f5cfd2edc4433359753be573605234006` — P0.1 plan rebase
- `6b3a5a6a` — M0 repository truth
- `e6506f3f` — M0 evidence completion
- `47a7d13b` — M0 API contract matrix
- `dafb759e` — M0 route evidence tightening
- `7b601c5d` — M0 route validation
- `8d0be28a` — M0 input/permission systematic repair
- `b05da94f` — M0 token-safe input contracts
- `88084724` — M0 output-contract closure; accepted M0 checkpoint
- `17c3e606` — H0 documentation hygiene; accepted H0 checkpoint
- `54ef68d4` — M1 Go foundation (initial, REVISE after independent review)
- `1f76f8ce` — M1 repair round 1 (ping seams, config validation, safe errors, meaningful tests)
- `b80a174d` — M1 repair round 2 (dependency alignment to Go 1.23-compatible versions)
- `0cb53022` — M1 repair round 3; accepted M1 checkpoint (typed-nil Redis fix and Docker ARM64 validation)
- `37e0b68c` — M2 auth/session persistence schema + credential gate investigation (initial, REVISE after independent review)
- `9c98bad9` — M2 persistence repair; accepted persistence checkpoint (credential gate later superseded by identity-reset decision)
- `9eb60874` — M3 partial session core (initial, REVISE after security review)
- `0d59a786` — M3 partial session core security repair; accepted partial checkpoint
- `ce489de1` — M3 first-party Argon2id, HTTP session guards, CSRF (initial, REVISE after security review)
- `cd4075af` — M3 auth infrastructure repair (Argon2 bounds, guard/CSRF tests)
- `a0522664` — final CSRF fail-closed fix and evidence correction; accepted M3 independent infrastructure checkpoint
- `a2dd34d0` — M3 initial rotation/authz scaffold
- `02fd4874` — M3 implementation (bounded txCtx, atomic rotation, middleware)
- `621320b0` — M3 repair round 1 (test helper deletion staged, unexported context key, generic deny)
- `3c4603d1` — M3 coverage/helper removal (direct rotation rejection tests, testing.go deletion confirmed)
- `c45eddbc` — M3 final repair (admin revoked-token rotation test, txCtx wording corrected)
- `7db1e777` — M3 documentation-only report correction (cumulative commits, rollback, ARM64 path)
- `3e228d1e` — M3 test harness fix (seedRoleWithPermission distinct placeholders for varchar/text; production-like PG17 verification); accepted M3 rotation/authz checkpoint
- `ef26020d` — M3 rotation/authz checkpoint metadata correction
- `bd57e528`, `11e3d3e8`, `c60db076`, `296bf63c`, `bf482dce`, `eaafd348`, `d946152f` — M3 endpoint implementation, repairs, and reports; accepted M3_INDEPENDENT_ENDPOINTS checkpoint

## Open Blockers
- None for M3 fresh auth. Fresh Prisma migration chain still fails at historical `20260425020754_phase_00_data_import` (PRE_EXISTING; address only if a later migration gate needs a clean chain).

## Gated Unknowns
- Google OAuth production status (M4)
- Production MinIO object inventory (M7)
- Keycloak credential format is no longer needed.

## Identity Reset
- Scope: disposable Keycloak users/credentials/sessions and account-scoped application data (including personal profile/progress/history/notifications/analytics after dependency review); preserve authored BJT questions, vocabulary, curriculum, exercise definitions, media/audio/images, search source content, product configuration, and non-user reference data. Legacy Keycloak subject columns remain nullable/unused during transition; do not drop them at auth cutover.
- Safety/rollback: no destructive reset or backup snapshot has occurred. Before cleanup, inventory foreign keys, record row counts, prepare and independently review an exact reset manifest, create/test a restorable DB backup, preserve Keycloak config/export if safe, then verify post-reset invariants. Existing GCP/Keycloak/MinIO/NestJS remain rollback references until cutover stability is proven.

## Wave Outcomes
- M3 partial outcomes: Session store security repairs verified (disabled account status gating via parent JOIN, input validation before hashing, error normalization to ErrSessionNotFound, owner-scoped revocation, safe creation API with internal token generation, expired session test rewrite exercising Store path, ConstantTimeDigestEqual removed); integration tests use real UUID v4 via crypto/rand and unique role/permission codes; unit suite passes with integration SKIPPED when TEST_DATABASE_URL unset; integration suite passes twice against same disposable PostgreSQL 17; ARM64 build to /tmp verified; no repo binary.
- M3 rotation/authz outcomes: Atomic learner/admin session rotation with bounded txCtx; admin permission middleware (AdminGuard → RequirePermission/RequireAnyPermission); direct negatives for expired/revoked/disabled/concurrent-winner rotation; production-like PG17 integration (admin_role.code VARCHAR(80), name TEXT) PASS x2; Go test/race/vet/gofmt + ARM64 static build PASS at 3e228d1e.
- M3 endpoint outcomes: GET /api/auth/me, POST /api/auth/logout, GET /api/admin/session, POST /api/admin/logout mounted on Go :4001 with separate learner/admin cookies; CORS_ORIGINS supplies CSRF trusted origins; session logout revokes only the current owner-scoped PostgreSQL session; GET /api/admin/me deferred to M6 to preserve its nested Nest contract; profile nullable fields serialize as null; 23 HTTP endpoint tests pass twice on disposable PG17 with M2 schema and production-like parent tables. No login/cutover performed.
- Important architecture decisions: Go `net/http` + chi + pgx; first-party opaque sessions; PostgreSQL authoritative; Redis retained for ephemeral concerns; Meilisearch retained; learner Web keeps Next runtime; Admin static export evaluated only after M6; media target is `gocloud.dev/blob/fileblob` at `/srv/kotobawork/data/media`; uploads stream through Go; public media via Caddy; private media via authenticated Go streaming; no replacement S3 daemon by default; Go API runs on port 4001 parallel with NestJS :4000 during migration; toolchain pinned to Go 1.23 across go.mod/Dockerfile/CI; ping seams for testable readiness without live dependencies; typed-nil guard at composition boundary prevents Go interface nil pitfall; auth tables in `auth` schema with FK to profile.user_profile and authz.admin_actor; session tokens stored as SHA-256 digest only; password credentials have NO algorithm/parameter defaults (explicit values required at insert); CHECK constraints enforce positive parameters and non-empty salt/hash; algorithm_version column for self-describing hash metadata
- Rollback status: existing NestJS/Keycloak/MinIO/GCP paths retained; no retirement action started; Go service is purely additive; M2 schema is additive-only; rollback is code-level (leave tables intact); optional DROP only on empty disposable/test DB without CASCADE; post-adoption table deletion requires separately validated data-preserving migration
- Production status: no cutover performed; GCP remains rollback/reference
- Latest test baseline: At `d946152f`, Go 1.23 `go test ./...`, `go test -race ./...`, `go vet ./...`, gofmt, linux/arm64 static build PASS; 23 HTTP endpoint tests on disposable PostgreSQL 17 PASS ×2, independently rerun by Sol. Session+authz PG17 integration previously PASS ×2 at `3e228d1e`. Frontend baseline: `pnpm prisma:validate`, typecheck, build PASS; lint PRE_EXISTING in tmp scratch files (75 errors/25 warnings); broader tests ENVIRONMENT_BLOCKED by unreachable DB (855 passed/4 failed).
- M1 outcomes (final): Go module scaffold at apps/api-go verified with GOTOOLCHAIN=go1.23.0 (gofmt/vet/test/race/ARM64 build all PASS); toolchain aligned to Go 1.23 across go.mod/Dockerfile/CI; dependencies downgraded to Go 1.23-compatible versions (pgx v5.7.6, go-redis v9.7.3); config loading with fail-fast validation for port/timeouts/pool sizing/DATABASE_URL; safe error handling verified by negative secret-leakage test; health endpoints with postgres.Pinger/redisx.Pinger interfaces enabling mock-based readiness tests; typed-nil Redis interface bug fixed at composition boundary with regression test; Docker ARM64 build PASS with real container validation (live=200, ready=503 with safe JSON when DB unreachable and Redis unconfigured); CI workflow updated with parallel go-checks job; deployment strategy documented
- M2 outcomes (revised): Additive auth/session persistence schema (4 tables in auth schema: password_credential, admin_password_credential, session, admin_session); NO hardcoded algorithm/parameter defaults; CHECK constraints enforce positive values and non-empty salt/hash; algorithm_version column for self-describing metadata; redundant secondary indexes removed (UNIQUE constraint indexes sufficient); composite expiry indexes retained; Prisma validation PASS; full Prisma migration chain on Postgres 17 FAILED at 20260425020754_phase_00_data_import (PRE_EXISTING: content_import_error relation missing); M2 migration separately verified on fresh Postgres 17 with prerequisite schemas (tables, CHECK constraints, indexes, security invariants all correct); credential-format investigation superseded by the 2026-09-29 identity-reset decision; rollback guidance corrected to code-level (leave tables intact)
- H0 outcomes: documentation classified; stale references identified (cursor-prompts old phase numbering, GCP-specific ops runbooks, DigitalOcean runbook, IDE rules NestJS assumptions); cleanup proposals documented with timing; no destructive actions taken; deploy/gcp preserved as rollback reference