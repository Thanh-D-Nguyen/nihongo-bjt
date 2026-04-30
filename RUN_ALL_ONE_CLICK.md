# NihonGo BJT — Cursor One-Click Mode

## Current Command Truth (2026-04-29)

Use root `package.json` scripts as the source of truth for quality gates:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm openapi:generate`
- `pnpm prisma:validate`
- `pnpm test:e2e` (or `pnpm test:e2e:local` when local web server is already running)

Phase-batch execution truth:

- Plan phase: `.github/prompts/32_*` through `.github/prompts/41_*`
- Run approved phase: `.github/prompts/29_boss_run_phase_batch.prompt.md`
- Continue after fixes: `.github/prompts/30_boss_continue_phase_after_fix.prompt.md`
- Final phase review: `.github/prompts/31_boss_phase_final_review.prompt.md`

Legacy XML one-click flows in this document are historical and should not override `company/OPERATING_MODE.md`.

## What this does

This pack supports a near one-click Cursor workflow. You paste one master XML prompt into Cursor Agent, and Cursor should execute phases 01 → 13 in order.

Phase 00 data import has already been completed and archived under `archive/phase-00-data-import/`. The active workflow should start from Phase 01 using the finalized PostgreSQL/Prisma schema and canonical content tables.

This is intentionally not a blind "build everything no matter what" prompt. The agent must run quality gates after each phase and stop if it cannot safely fix a blocking issue.

## Recommended usage

1. Extract this zip into the project root.
2. Open the project root in Cursor.
3. Make sure Cursor Agent can see:
   - `AGENTS.md`
   - `.cursor/rules/*.mdc`
   - `docs/spec/nihongo_bjt_cursor_master_spec_v14.md`
   - `docs/spec/nihongo_bjt_cursor_master_spec_v14_1_final.md`
   - `docs/cursor-prompts/RUN_ALL_ONE_CLICK.xml`
4. Open `docs/cursor-prompts/RUN_ALL_ONE_CLICK.xml`.
5. Paste the whole file into Cursor Agent.
6. Let it run.

## Safer alternative

If this is not an empty repo, use:

```text

docs/cursor-prompts/RUN_ALL_SAFE_MODE.xml

```

Safe mode forces Cursor to inspect existing code first and avoid destructive rewrites.

## Expected behavior

Cursor should:

- create the monorepo structure;
- implement backend, frontend, database, admin, analytics, daily hub, battle, and product readiness progressively;
- run checks after every phase;
- commit nothing automatically unless you explicitly ask;
- report remaining gaps at the end.

## If Cursor stops

Read the blocker message. Usually you can then paste:

```xml
<cursor_task>
  <task>Fix the blocker you just reported, then continue from the failed phase.</task>
</cursor_task>
```

## Important

This pack is configured to prevent demo-style implementation. Cursor should implement smaller real vertical slices with persistence, validation, RBAC, i18n, tests, and quality gates rather than broad fake screens.

This pack includes Phase 11 for monetization, Phase 12 for social auth/SNS sharing growth, and Phase 13 for Japanese reading assist.
