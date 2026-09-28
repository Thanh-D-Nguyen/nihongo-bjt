# 16 — Background Jobs Migration

## Scope

All background work currently embedded in the NestJS process must be migrated to Go before NestJS retirement (M15).

### Known cron jobs

| Job | Schedule | Timezone | Source |
|-----|----------|----------|--------|
| ComebackExperienceCron | `0 10 * * *` | Asia/Ho_Chi_Minh | `apps/api/src/gamification/comeback-experience.cron.ts` |
| MagazineGenerationCron | `30 5 * * *` | Asia/Ho_Chi_Minh | `apps/api/src/magazine/magazine-generation.cron.ts` |
| LotoAutopilotCron | (inspect source) | Asia/Ho_Chi_Minh | `apps/api/src/magazine/loto/loto-autopilot.cron.ts` |
| PushNotificationCron | (inspect source) | (inspect source) | `apps/api/src/notifications/push-notification.cron.ts` |
| SmartNotificationCron | (inspect source) | (inspect source) | `apps/api/src/notifications/smart-notification.cron.ts` |

### Known BullMQ queue usage

BullMQ is used in at least these modules:

- `recommendation` — recommendation pipeline
- `quiz/revenge-mode` — revenge mode processing
- `operations` — operational sweeps
- `analytics` — analytics system admin repository

M0 must produce a complete inventory of:

- producers (who enqueues what)
- consumers (who processes what)
- retry policies
- dead-letter behavior
- scheduling semantics
- timezone handling
- deduplication / idempotency keys
- persistence requirements
- failure/alerting semantics
- concurrency limits

## Architecture selection gate

Do NOT prematurely commit to `robfig/cron`, Asynq, River, or any other specific library during P0.1.

M0 inventory drives the selection. Criteria include:

- complexity vs. actual job count
- persistence requirement (Redis-backed vs PostgreSQL-backed vs in-process)
- retry/dead-letter needs
- observability requirements
- ARM64 compatibility
- maintenance status and community health
- operational simplicity on a single host

If scheduled execution runs in-process, design duplicate-run protection for future multi-instance possibility (e.g., Redis-based leader election or advisory locks).

## Migration wave: M10

M10 occurs after business write APIs (M9) are proven, so job handlers can call migrated Go services directly.

Steps:

1. Complete M0 job inventory with full producer/consumer/retry/schedule details.
2. Select Go architecture based on inventory evidence.
3. Implement scheduler/worker infrastructure.
4. Migrate each job with contract-equivalent behavior.
5. Preserve timezone-aware scheduling (Asia/Ho_Chi_Minh).
6. Add structured logging and metrics for every job execution.
7. Test failure/retry paths explicitly.
8. Run parallel execution against NestJS during stability window.
9. Verify idempotency under concurrent/duplicate triggers.
10. Disable NestJS jobs only after Go jobs proven stable.

## Observability

Every job execution must log:

- job name
- trigger (cron schedule / queue message / manual)
- start/end timestamps
- duration
- success/failure
- items processed (where applicable)
- error detail on failure

Expose counters/histograms for monitoring and alerting.

## Rollback

During transition, both NestJS and Go job runners may coexist. Use feature flags or configuration to disable one side without code changes. Ensure no double-execution during cutover.