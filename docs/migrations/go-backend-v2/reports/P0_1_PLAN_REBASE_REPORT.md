# P0_1_PLAN_REBASE_REPORT

## Git
- **starting HEAD:** `b615f4fb0ceb786ad1b86f7f0d5f21c6c466a5f7`
- **final HEAD:** (pending commit)
- **branch:** `main`
- **commit:** (pending — `docs: rebaseline go backend migration plan from repository audit`)
- **preserved dirty files:**
  - `.claude/settings.local.json` (modified, unrelated)
  - `apps/admin/next-env.d.ts` (modified, unrelated)
  - `apps/admin/tsconfig.tsbuildinfo` (modified, unrelated)
  - `apps/web/next-env.d.ts` (modified, unrelated)
  - `apps/web/tsconfig.tsbuildinfo` (modified, unrelated)
  - `.tmp-gate1.mts` (untracked, unrelated)
  - `.tmp-wave2-qa-state.mts` (untracked, unrelated)
  - `docs/design/bjt-learner-redesign/.file-versions/` (untracked, unrelated)
  - `docs/design/bjt-learner-redesign/.od-frames/` (untracked, unrelated)

## Architectural Decisions Applied

All 19 ChatGPT-approved architectural decisions have been applied to the migration workspace:

1. **Go backend** — net/http + chi, pgx, sqlc, slog, go-redis confirmed across all docs.
2. **Keycloak removal scope** — expanded to include learner Web, Admin, `nihongo-mobile`, backend, realtime, Google OAuth, RBAC mapping, and Keycloak subject mappings in docs 03, 06, 15.
3. **Password migration UNDECIDED** — hard investigation gate added as M2 prerequisite in docs 03, 04, 06, 12.
4. **Storage: fileblob without presigned URLs** — upload architecture changed to server-proxied streaming in docs 02, 06, 13, 18; BlobStore interface excludes SignedURL.
5. **Public media via Caddy file_server** — documented in docs 02, 13, 18 with cache/MIME/Range/conditional request support.
6. **Private media via Go streaming** — `http.ServeContent` with auth+authorization in docs 02, 13, 18; explicit prohibition on Caddy file_server for private media.
7. **Storage path corrected** — `/srv/kotobawork/data/media` used consistently in docs 02, 06, 09, 13, 18.
8. **Learner Web: KEEP_NEXT_RUNTIME** — canonical classification in docs 02, 06, 12, 14; static export explicitly prohibited during migration.
9. **Admin: NEEDS_INVESTIGATION_POST_M6** — evaluation deferred until after M6 auth cutover in docs 02, 06, 12, 14.
10. **Mobile client (`nihongo-mobile`)** — dedicated doc 15 created; PKCE/public-client semantics preserved; M5.5 wave added; retirement gate requires mobile migrated or explicitly retired.
11. **Background jobs** — dedicated doc 16 created; M10 wave added; library selection deferred to M0 inventory; duplicate-run protection required.
12. **Realtime** — dedicated doc 17 created; M12 wave added; SSE explicitly excluded for Battle; library selection deferred to M0/M12 inventory.
13. **Google OAuth** — decision gate added to M4 in docs 03, 06; migrate if active, retire with documentation if inactive.
14. **Billing webhooks** — explicit scope in docs 05, 11, 12; preserve exact signature verification and idempotency.
15. **Sharp/image processing** — inventory requirement added to M0/M11 in docs 05, 12; library decision deferred.
16. **Application containerization** — ARM64 build strategy added to M1 in docs 06, 12; no unnecessary NestJS Dockerfiles.
17. **Caddy security** — admin IP restriction disposition documented in docs 10; preserve or formally retire based on new architecture.
18. **Meilisearch retained** — confirmed in docs 02, 09; PostgreSQL FTS only as future optional optimization.
19. **Redis retained** — confirmed in docs 02, 09, 10; not authoritative for durable identity/business state.

## Documents Updated

| Document | Changes |
|----------|---------|
| `START_HERE.md` | Complete rewrite: rebaselined architecture diagram, storage principle, upload architecture decision, media read paths, non-negotiable principles, read order including docs 15–18, report index. |
| `GHOSTCLI_MASTER_PROMPT.md` | Complete rewrite: rebaselined mission/target, hard rules, Go stack, storage target with streaming upload, frontend runtime classifications, auth scope including mobile/password gate, background jobs/realtime/billing/image/containerization/Caddy sections, rebaselined wave sequence, resource objective. |
| `docs/02_target_architecture.md` | Rebaselined architecture diagram, storage section with upload architecture and media read paths, frontend runtime classifications, mobile/jobs/realtime sections. |
| `docs/03_auth_replacement_spec.md` | Expanded scope (mobile, Google OAuth, realtime), password migration UNDECIDED with investigation gate, CSRF/session lifecycle/RBAC details, mobile PKCE requirements, Keycloak retirement gate. |
| `docs/04_data_migration.md` | Identity model transition schema, password migration gate, dual-read/dual-write guidance, Go migration handoff strategy, verification queries, media metadata migration reference. |
| `docs/05_api_migration.md` | Updated migration order including streaming uploads/billing/jobs/realtime/image processing, BlobStore/media references, billing webhook and image processing sections. |
| `docs/06_execution_waves.md` | Complete rebase: P0→M16 wave sequence with M5.5/M6.5/M10/M12 insertions, detailed per-wave deliverables, retirement ordering. |
| `docs/07_testing_strategy.md` | Added streaming upload/media tests, mobile PKCE tests, WebSocket auth tests, ARM64 build tests, performance measurements for streaming/realtime. |
| `docs/08_rollout_and_rollback.md` | Updated rollback artifacts for media/jobs/realtime, password migration rollback semantics, retirement ordering. |
| `docs/09_oracle_resource_budget.md` | Updated steady-state table (KEEP_NEXT_RUNTIME for Web, Admin conditional), corrected storage path, streaming upload memory considerations. |
| `docs/10_security_baseline.md` | Added media security controls (path traversal, upload limits, public/private separation), WebSocket security, billing webhook security, Caddy security control disposition. |
| `docs/11_observability.md` | Added streaming upload/private media/WebSocket/background job metrics and alerts. |
| `docs/12_definition_of_done.md` | Complete rebase: all checklist items updated for rebaselined architecture, mobile/jobs/realtime/billing/image processing items added. |
| `docs/13_storage_architecture.md` | Complete rewrite: fileblob decision rationale, BlobStore interface without SignedURL, streaming upload architecture, filesystem layout, public/private read paths, HTTP Range, MinIO migration procedure. |
| `docs/14_static_frontend_audit.md` | Canonical classifications (KEEP_NEXT_RUNTIME / NEEDS_INVESTIGATION_POST_M6), auth impact analysis, locale routing consideration. |

## Documents Added

| Document | Purpose |
|----------|---------|
| `docs/15_mobile_auth_migration.md` | `nihongo-mobile` PKCE flow migration, token endpoint compatibility, custom redirect URI, refresh token behavior, claims/audience, M5.5 wave, retirement gate. |
| `docs/16_background_jobs_migration.md` | Cron/BullMQ inventory requirements, architecture selection gate (no premature library commitment), M10 wave, observability, rollback. |
| `docs/17_realtime_migration.md` | Socket.IO gateway/event inventory, architecture selection gate (no SSE for Battle), M12 wave, connection authentication, observability, rollback. |
| `docs/18_media_delivery_architecture.md` | Public/private media path separation, Caddy file_server config, Go streaming private handler, server-proxied streaming upload implementation requirements, object key generation, security controls, future optimization note. |

## Wave Rebaseline

```text
P0     Plan revalidation                         DONE
P0.1   Plan rebase                               DONE (this report)
M0     Repository truth / detailed inventory
H0     Documentation hygiene
M1     Go foundation + deployment foundations
M2     Identity/auth persistence + Keycloak credential investigation gate
M3     Auth core
M4     Account lifecycle + Google OAuth decision/migration
M5     Learner Web auth cutover
M5.5   Mobile auth cutover                       NEW
M6     Admin auth cutover
M6.5   Admin static-runtime evaluation           NEW
M7     BlobStore + media migration (streaming uploads, Caddy public, Go private)
M8     Business read APIs
M9     Business write APIs
M10    Background jobs / queue migration          NEW
M11    Remaining integrations (billing webhooks, image processing)
M12    Realtime migration                         NEW
M13    Keycloak disable
M14    MinIO disable
M15    NestJS disable
M16    Oracle runtime/resource optimization
```

Key dependency changes from original plan:
- M5.5 inserted between M5 and M6 (mobile after learner web, before admin).
- M6.5 inserted after M6 (admin static eval only after auth cutover proven).
- M10 is now dedicated background jobs wave (was previously implicit/missing).
- M12 is now dedicated realtime wave (was previously implicit/missing).
- M7 depends on upload architecture decision (resolved: server-proxied streaming).
- M13 gate now requires mobile migrated or explicitly retired.
- M15 gate now requires jobs/realtime/webhooks/image processing migrated.

## Resolved P0 Findings

Every required amendment from `P0_PLAN_REVALIDATION_REPORT.md`:

| # | Required Amendment | Status | Evidence |
|---|-------------------|--------|----------|
| 1 | Resolve upload/download architecture decision | RESOLVED | Server-proxied streaming upload documented in docs 02, 06, 13, 18; BlobStore interface excludes SignedURL. |
| 2 | Add mobile client to auth migration scope | RESOLVED | Doc 15 created; M5.5 wave added; referenced in docs 03, 06, 12; retirement gate requires mobile migrated or retired. |
| 3 | Add background job migration wave | RESOLVED | Doc 16 created; M10 wave added with full inventory requirements; referenced in docs 05, 06, 12. |
| 4 | Add realtime protocol migration wave | RESOLVED | Doc 17 created; M12 wave added; SSE excluded for Battle; referenced in docs 03, 05, 06, 10, 12. |
| 5 | Correct Web runtime to KEEP_NEXT_RUNTIME | RESOLVED | Canonical classification in docs 02, 06, 12, 14; static export explicitly prohibited. |
| 6 | Reclassify Admin static export as post-M6 evaluation | RESOLVED | NEEDS_INVESTIGATION_POST_M6 in docs 02, 06, 12, 14; M6.5 wave added. |
| 7 | Add Keycloak credential investigation as M2 prerequisite | RESOLVED | Hard gate documented in docs 03, 04, 06, 12; approach remains UNDECIDED until evidence gathered. |
| 8 | Add Google OAuth decision to M4 scope | RESOLVED | Decision gate in docs 03, 06; migrate if active, retire with documentation if inactive. |
| 9 | Add application Dockerfile strategy to M1 | RESOLVED | ARM64 build strategy and containerization audit in docs 06, 12; no unnecessary NestJS Dockerfiles. |
| 10 | Update storage paths to `/srv/kotobawork/data/media` | RESOLVED | Consistent across docs 02, 06, 09, 13, 18. Only stale reference is in P0 report (historical artifact). |
| 11 | Update Caddy configuration plan | RESOLVED | file_server for public media, auth-gated Go private reads, admin IP restriction disposition in docs 10, 13, 18. |
| 12 | Add mobile client cutover as M12→M13 gate prerequisite | RESOLVED | M13 (Keycloak disable) gate requires mobile migrated or explicitly retired in docs 03, 06, 12, 15. |

No silent omissions. All 12 amendments resolved.

## Remaining Unknowns For M0

These are intentionally deferred to M0 inventory and cannot be resolved during P0.1:

1. **Keycloak credential storage format** — must inspect actual Keycloak DB/export to determine password migration approach.
2. **Google OAuth production status** — must check API logs/config to determine if active.
3. **Complete BullMQ producer/consumer inventory** — must trace all queue usages across NestJS modules.
4. **Complete Socket.IO event contract** — must document all payload shapes, ack semantics, room management.
5. **Sharp/image processing operations inventory** — must catalog resize/proxy/render operations and formats.
6. **Flutter mobile app actual auth flow** — must inspect Flutter source to confirm which OAuth flows are used.
7. **Current application deployment mechanism** — must determine how NestJS/Next.js are actually containerized/deployed today.
8. **MinIO bucket/object inventory** — must catalog all objects, sizes, checksums, public/private classification.
9. **Stripe/billing webhook exact contracts** — must document signature verification and idempotency keys.
10. **Admin static export viability factors** — can only be evaluated after M6 proves Go auth works.

## Consistency Validation

Searches performed against the rebaselined workspace:

### Stale "Web static export" references
- All remaining "static export" mentions correctly refer to Admin post-M6 evaluation only.
- No references suggest Web could be static. ✅

### Stale presigned URL assumptions
- One reference in `docs/12_definition_of_done.md` line 8 mentions "presigned PUT/GET" in the context of *identifying current MinIO responsibilities* during M0 inventory. This is correct — it describes what exists today that must be inventoried, not a target assumption. ✅
- All target architecture docs correctly exclude presigned URLs from BlobStore interface. ✅

### Stale `/srv/kotobawork/media` without `/data`
- Only occurrence is in `reports/P0_PLAN_REVALIDATION_REPORT.md` (the historical P0 report documenting what was found). All active plan docs use `/srv/kotobawork/data/media`. ✅

### Mobile coverage
- All core docs (03, 06, START_HERE, GHOSTCLI_MASTER_PROMPT) reference `nihongo-mobile`. ✅
- Dedicated doc 15 exists. ✅

### Background jobs coverage
- All core docs (05, 06, START_HERE, GHOSTCLI_MASTER_PROMPT) reference background jobs/M10. ✅
- Dedicated doc 16 exists. ✅

### Realtime coverage
- All core docs (03, 05, 06, START_HERE, GHOSTCLI_MASTER_PROMPT) reference realtime/M12. ✅
- Dedicated doc 17 exists. ✅

### Contradictory wave numbering
- Wave sequence is consistent across START_HERE, GHOSTCLI_MASTER_PROMPT, and docs/06. ✅
- No references to old M0–M15 numbering remain. ✅

### Credentials/secrets check
- No credentials, passwords, tokens, or secrets present in any migration workspace file. ✅

### Internal link resolution
- All cross-document references (e.g., "See docs/15_mobile_auth_migration.md") point to existing files. ✅

## Gate

**P0_1_PASS**

All 19 architectural decisions applied. All 12 P0 required amendments resolved. Four new documents created. Fifteen existing documents updated. Wave sequence rebaselined. Consistency validation passed. No stale assumptions remain in active plan documents. Ready for ChatGPT review and M0 prompt.