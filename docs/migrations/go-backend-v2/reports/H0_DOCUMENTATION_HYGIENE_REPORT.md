# H0 Documentation Hygiene Report

## Identification
- **Starting HEAD**: `6072c24e2e9b97dde32947b428a8d33b26d9824b`
- **Accepted H0 checkpoint**: `17c3e606b0a333103445ed054582b726bff52781`
- **Branch**: `main`
- **Wave**: H0 — Documentation hygiene
- **Date**: 2026-09-28
- **Accepted M0 checkpoint**: `8808472426195547c779c662981d8dc582b580ca`

## Scope
Documentation classification and cleanup proposal only. No files deleted, moved, renamed, or archived. No application code changes. GCP deployment docs preserved as rollback reference per canonical H0 definition.

## Classification Summary

| Path / Area | Status | Rationale |
|---|---|---|
| `AGENTS.md` | CANONICAL | Active AI agent operating guide; references current workspace structure |
| `AI_CONTEXT.md` | CANONICAL | AI assistant brief; aligned with rebaselined architecture |
| `README.md` | CANONICAL | Developer setup guide; references current stack (NestJS/Next.js/Keycloak/MinIO) |
| `docs/spec/*` | CANONICAL | Product specifications; independent of backend implementation |
| `docs/migrations/go-backend-v2/docs/01–18` | CANONICAL | Rebaselined migration plan (P0.1 applied); authoritative for M1+ |
| `docs/migrations/go-backend-v2/START_HERE.md` | CANONICAL | Migration entry point; rebaselined |
| `docs/migrations/go-backend-v2/GHOSTCLI_MASTER_PROMPT.md` | CANONICAL | AI orchestrator prompt; rebaselined |
| `docs/migrations/go-backend-v2/templates/*` | CANONICAL | M0 evidence artifacts (API matrix, auth matrix, media inventory, repo inventory, migration status) |
| `docs/migrations/go-backend-v2/reports/*` | CANONICAL | P0, P0.1, M0, H0 reports |
| `docs/migrations/go-backend-v2/reference-go-layout/*` | CANONICAL | Go scaffold reference for M1 |
| `docs/migrations/go-backend-v2/scripts/*` | CANONICAL | M0 audit/baseline scripts |
| `docs/deployment/gcp.md` | HISTORICAL/ROLLBACK_REFERENCE | GCP-specific deployment guide; preserve until OCI cutover proven |
| `docs/deployment/gcp-console-guide.md` | HISTORICAL/ROLLBACK_REFERENCE | GCP console walkthrough; preserve as rollback reference |
| `docs/deployment/oci.md` | ACTIVE | OCI target deployment guide; aligns with deploy/oci/ |
| `docs/ops/*` | TRANSITIONAL | Operational runbooks; many are GCP-specific (see stale references below) |
| `docs/product/*` | CANONICAL | Product design docs; backend-agnostic |
| `deploy/gcp/*` | HISTORICAL/ROLLBACK_REFERENCE | GCP deployment scripts/compose/Caddy template; MUST preserve until OCI stability gate passed |
| `deploy/oci/*` | ACTIVE | OCI target deployment (compose.data.yml, Caddyfile.template, Dockerfile.minio) |
| `docker/keycloak/*` | TRANSITIONAL | Local Keycloak dev setup; retires at M13 (Keycloak disable) |
| `archive/phase-00-data-import/*` | HISTORICAL | Completed phase; already archived |
| `archive/audit-2026-09/*` | HISTORICAL | Completed audit |
| `.cursor/rules/*.mdc` | ACTIVE | Cursor IDE rules; review for stale NestJS-only assumptions at M1 |
| `.github/instructions/*` | ACTIVE | GitHub Copilot instructions; review for stale assumptions at M1 |
| `docs/cursor-prompts/*.xml` | NEEDS_FOLLOW_UP | Phase-numbered prompts (phase-01 through phase-13) use OLD phase numbering that predates rebaselined M0–M16 wave sequence |
| `docs/design/bjt-learner-redesign/*` | ACTIVE | Parallel design work; unrelated to backend migration |

## Stale/Conflicting References Identified

### 1. docs/cursor-prompts/ — Old Phase Numbering
**Files affected**: All 13 XML prompt files (`phase-01-foundation.xml` through `phase-13-japanese-reading-assist.xml`)
**Issue**: These use a pre-rebase "phase" numbering system (phase-01 through phase-13) that does not correspond to the rebaselined M0–M16 wave sequence established in P0.1. The prompts reference old architectural assumptions (e.g., potential static export for web, presigned URL storage) that were explicitly corrected during P0.1 rebase.
**Risk**: Using these prompts would generate code/architecture inconsistent with the rebaselined plan.
**Proposed action**: Mark as NEEDS_FOLLOW_UP. After M1 establishes Go scaffold, evaluate whether to update prompts to match M-wave numbering or retire them in favor of direct doc references.
**Timing**: Post-M1 evaluation.

### 2. docs/ops/ — GCP-Specific Runbooks Without OCI Equivalents
**Files affected**:
- `gcp-battle-mobile-responsive-runbook.md`
- `gcp-content-dictionary-and-onboarding-runbook.md`
- `gcp-homepage-mobile-responsive-runbook.md`
- `gcp-keycloak-publish-cicd-guide.md`
- `deploy-gcp-credit-runbook.md`
- `cicd-github-actions-gcp.md`
- `deploy-digitalocean-step-by-step.md` (DigitalOcean — neither GCP nor OCI)

**Issue**: These operational runbooks are tied to GCP infrastructure. No OCI equivalents exist yet. The DigitalOcean runbook references a third cloud provider not in current deployment topology.
**Risk**: Operators following these during/after OCI migration would execute incorrect procedures.
**Proposed action**: Classify as TRANSITIONAL. Preserve as-is for GCP rollback. Create OCI-equivalent runbooks as part of M1 deployment foundations. Add header notice to each file indicating GCP-specific status.
**Timing**: OCI runbook creation at M1; header notices can be added at H0 if approved.

### 3. docs/ops/deploy-digitalocean-step-by-step.md — Obsolete Cloud Provider
**Issue**: 33.5KB runbook for DigitalOcean deployment. Neither GCP nor OCI. No evidence of active DigitalOcean usage in repository.
**Risk**: Confusion about deployment target.
**Proposed action**: Classify as HISTORICAL. Add deprecation notice. No deletion.
**Timing**: H0 (notice only).

### 4. docs/ops/keycloak.md and keycloak-app-integration.md — Pre-Rebase Assumptions
**Issue**: These docs may contain pre-P0.1 assumptions about Keycloak integration that don't reflect the explicit retirement plan. However, they remain valid as CURRENT STATE documentation until M13.
**Risk**: Low — these describe current behavior which is still accurate.
**Proposed action**: Classify as TRANSITIONAL. Add note linking to docs/03_auth_replacement_spec.md for migration context.
**Timing**: Post-H0, pre-M2.

### 5. .cursor/rules/ and .github/instructions/ — Potential NestJS-Only Assumptions
**Issue**: Coding rules and AI instructions may assume NestJS/TypeScript patterns that won't apply to Go backend. Specific files to review at M1:
- `02-api-swagger.mdc` — Swagger/OpenAPI rules are NestJS-specific
- `01-production-coding.mdc` — May assume TypeScript conventions
- `production-first.instructions.md` — May reference NestJS patterns

**Risk**: AI assistants generating Go code using NestJS-flavored rules.
**Proposed action**: Classify as ACTIVE with NEEDS_FOLLOW_UP flag. Review and add Go-specific rules at M1.
**Timing**: M1 (when Go scaffold exists).

### 6. P0_PLAN_REVALIDATION_REPORT.md — Contains Superseded Storage Path
**File**: `docs/migrations/go-backend-v2/reports/P0_PLAN_REVALIDATION_REPORT.md` line 111
**Issue**: References `/srv/kotobawork/media` (without `/data`). This was correctly identified and resolved in P0.1 — all active docs use `/srv/kotobawork/data/media`. The P0 report is a historical artifact documenting what was found, so this is acceptable.
**Risk**: None — clearly labeled as historical revalidation report.
**Proposed action**: No change needed. Already classified as historical evidence.

### 7. templates/migration-status.md — Wave/HEAD References Need Update
**Issue**: Current content references M0 as current wave with pending revision HEAD. Needs update to reflect H0 completion and M1 as next.
**Proposed action**: Update to mark H0 complete, M1 as next wave, preserve all M0 evidence facts.
**Timing**: This commit.

## Cleanup Proposals (No Execution)

| # | Target | Action | Timing | Approval Required |
|---|--------|--------|--------|-------------------|
| 1 | `docs/cursor-prompts/phase-*.xml` | Add deprecation header noting old phase numbering; link to docs/06_execution_waves.md | Post-M1 | Yes |
| 2 | `docs/ops/gcp-*.md`, `deploy-gcp-credit-runbook.md`, `cicd-github-actions-gcp.md` | Add "GCP-SPECIFIC — see deploy/oci/ for target deployment" header | M1 (with OCI runbook creation) | Yes |
| 3 | `docs/ops/deploy-digitalocean-step-by-step.md` | Add "HISTORICAL — not current deployment target" header | H0 (if approved) | Yes |
| 4 | `docs/ops/keycloak.md`, `keycloak-app-integration.md` | Add link to docs/03_auth_replacement_spec.md | Pre-M2 | Yes |
| 5 | `.cursor/rules/02-api-swagger.mdc` | Add Go OpenAPI section or separate Go rules file | M1 | Yes |
| 6 | `deploy/gcp/*` | PRESERVE AS-IS — rollback reference until OCI stability gate | No action until post-M16 | N/A |
| 7 | `docker/keycloak/*` | PRESERVE — retires at M13 | No action until M13 | N/A |
| 8 | `archive/phase-00-data-import/` | No action — already archived | Never | N/A |

## Preservation Mandates

1. **deploy/gcp/**: ALL files preserved intact. GCP remains production deployment and rollback reference until OCI cutover is proven stable. No modifications, deletions, or moves.
2. **docs/deployment/gcp.md, gcp-console-guide.md**: Preserved as rollback reference.
3. **docs/ops/**: All files preserved. GCP-specific runbooks remain valid for current production operations.
4. **docker/keycloak/**: Preserved. Required for local development and current production Keycloak operations until M13.
5. **All unrelated dirty files**: Preserved exactly as found.

## Conflicts Found
None. All rebaselined migration docs (01–18, START_HERE, GHOSTCLI_MASTER_PROMPT) are internally consistent. Stale references are confined to peripheral docs (cursor-prompts, ops runbooks, IDE rules) that don't contradict the canonical plan — they simply predate it.

## Verification Checklist
- [x] No files deleted, renamed, moved, or archived
- [x] No application code changes
- [x] No deploy/gcp or GCP rollback docs modified
- [x] Report facts derived from actual repository inspection
- [x] All classifications grounded in repository evidence
- [x] GCP preservation mandate explicit
- [x] Cleanup proposals specify action + timing without execution

## Gate Recommendation
**H0_PASS** — Documentation classified, stale references identified, cleanup proposals documented with timing. No destructive actions taken. Ready for M1.
