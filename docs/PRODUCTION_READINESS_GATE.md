# Production Readiness Gate

## Phase

- phase_id: PHASE-09
- date: 2026-04-30
- decision: no_ship
- release_boundary: reached

## Gate Summary

| Gate | Status | Evidence |
| --- | --- | --- |
| lint | fail | `pnpm lint` failed with 290 issues (289 errors, 1 warning). |
| typecheck | pass | `pnpm -w exec turbo run typecheck` passed. |
| test | fail | `pnpm test` failed: 1/272 tests failed (`asset.provenance` column missing). |
| build | pass | `pnpm build` passed across web/admin/api packages. |
| prisma validate | pass | `pnpm prisma:validate` passed. |
| prisma generate | pass | `pnpm prisma:generate` passed. |
| prisma migrate status | fail | `pnpm prisma:migrate:check` failed: 2 unapplied migrations. |
| openapi generate | pass | `pnpm --filter @nihongo-bjt/api openapi:generate` passed. |
| security/privacy/rbac/audit bundle | pass | 46/46 targeted tests passed. |
| monetization entitlement/quota bundle | pass | 12/12 targeted tests passed. |
| domain quality bundle | pass_with_risks | 33/33 tests passed, with non-blocking React act warnings in one web test file. |
| no-fake-production | pass_with_risks | No fake-success endpoint found in this gate run; release blocked by failing CI/migration readiness. |
| rollback safety | pass_with_risks | Pending migrations are additive (`ADD COLUMN`) with low destructive risk; rollback drill still tracked from PH08-R02. |

## Blocking Findings

1. CI truth gate is red because `pnpm lint` fails.
2. CI truth gate is red because `pnpm test` fails in `apps/api/src/flashcards/flashcards-leech-remediation.integration.spec.ts` due DB/schema drift.
3. Migration gate is red because migrations `20260430041000_media_accessibility_provenance_contract` and `20260430052000_share_postcard_opt_in` are not applied.

## Release Director Decision

```yaml
release_director:
  decision: no_ship
  phase_id: PHASE-09
  blockers:
    - lint red (workspace)
    - test red (flashcards integration test)
    - migration status red (2 unapplied migrations)
  residual_risks:
    - PH08-R02 backup/restore drill depth (accepted)
    - PH07-R03 historical analytics payload hygiene (open)
  next_decision:
    - REQUEST_PHASE_FIXES
```

## Required Fix Path

1. Apply pending migrations in target environment (`prisma migrate deploy`) and verify DB schema parity.
2. Re-run `pnpm test` and confirm `flashcards-leech-remediation.integration.spec.ts` passes after schema parity.
3. Resolve lint baseline or scope lint rule alignment to remove red CI state.
4. Re-run full PHASE-09 release bundle and request `RUN_RELEASE_GATE`.
