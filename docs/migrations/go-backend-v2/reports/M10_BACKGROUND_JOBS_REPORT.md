# M10 — Background Jobs / Queue Migration Report

**Status:** COMPLETE  
**Date:** 2026-09-29  
**Branch:** main  
**Accepted HEAD before:** b987983f (M9 business write)

## Summary

Implemented Go background jobs infrastructure using `robfig/cron/v3` with PostgreSQL advisory lock protection, timezone-aware scheduling, config-driven enable/disable, and structured slog logging. All known NestJS cron jobs have Go equivalents (stubs for complex business logic). No actual BullMQ processors were found in the NestJS source — queue equivalents are documented as stubs.

## Architecture Decision

**Selected:** `robfig/cron/v3` (in-process scheduler)  
**Justification:**
- Inspection of NestJS source revealed zero actual BullMQ `@Processor` or `Queue()` registrations — all "queues" in the spec are conceptual/aspirational
- Only 10 cron schedules exist across 5 source files
- Single-host deployment; no cross-worker job distribution needed
- PostgreSQL advisory locks provide duplicate-run protection without Redis dependency
- Minimal dependency footprint (one new module: `github.com/robfig/cron/v3 v3.0.1`)

**Rejected alternatives:**
- Asynq/River: overkill for cron-only workload with no queue consumers
- Redis-backed scheduler: adds operational complexity with no proven need
- Custom ticker loop: loses timezone parsing, DST handling, and standard cron syntax

## Files Created

| File | Purpose |
|------|---------|
| `apps/api-go/internal/jobs/config.go` | Config struct + env-var loading (JOBS_ENABLED, LOTO_AUTOPILOT_ENABLED) |
| `apps/api-go/internal/jobs/scheduler.go` | Scheduler with advisory locks, tzSchedule wrapper, structured logging |
| `apps/api-go/internal/jobs/handlers.go` | Handler stubs for all 10 cron jobs + 4 queue equivalents |
| `apps/api-go/internal/jobs/register.go` | RegisterAll wiring: schedules, timezones, handler binding |
| `apps/api-go/internal/jobs/scheduler_test.go` | Unit tests (config, lock keys, disabled mode) + integration test skeleton |

## Files Modified

| File | Change |
|------|--------|
| `apps/api-go/internal/app/app.go` | Added jobs import, Scheduler field, init in New(), Stop() in Shutdown() |
| `apps/api-go/go.mod` / `go.sum` | Added `github.com/robfig/cron/v3 v3.0.1` |

## Cron Job Inventory

| Go Job Name | Schedule | Timezone | NestJS Source | Status |
|-------------|----------|----------|---------------|--------|
| comeback_experience | `0 10 * * *` | Asia/Ho_Chi_Minh | comeback-experience.cron.ts | Stub (TODO: findEligibleUsers query) |
| magazine_generation | `30 5 * * *` | Asia/Ho_Chi_Minh | magazine-generation.cron.ts | Stub (TODO: generateForDate) |
| push_notification_daily_kanji | `0 7 * * *` | Asia/Ho_Chi_Minh | push-notification.cron.ts | Stub (TODO: sendDailyKanjiToAll) |
| smart_notification_pet_care | `0 18 * * *` | Asia/Ho_Chi_Minh | smart-notification.cron.ts | Stub (TODO: sendPetCareReminders) |
| smart_notification_streak_save_early | `0 20 * * *` | Asia/Ho_Chi_Minh | smart-notification.cron.ts | Stub (TODO: sendStreakSaveReminders) |
| smart_notification_streak_save_last | `0 22 * * *` | Asia/Ho_Chi_Minh | smart-notification.cron.ts | Stub (same handler, different schedule) |
| smart_notification_study_slot | `0 * * * *` | Asia/Ho_Chi_Minh | smart-notification.cron.ts | No-op (matches NestJS stub behavior) |
| loto_autopilot_loto6 | `0,30 21-23 * * 1,4` | Asia/Tokyo | loto-autopilot.cron.ts | Stub (TODO: runAutopilotIfResultReady) |
| loto_autopilot_loto7 | `0,30 21-23 * * 5` | Asia/Tokyo | loto-autopilot.cron.ts | Stub (TODO: runAutopilotIfResultReady) |
| loto_autopilot_catchup | `15 6 * * *` | Asia/Tokyo | loto-autopilot.cron.ts | Stub (TODO: catchup tick) |

## Queue Equivalents (Stubs)

No BullMQ processors were found in the NestJS codebase. These are placeholders for future async work:

- `recommendation_pipeline` — conceptual recommendation queue
- `quiz_revenge_mode` — conceptual revenge-mode queue
- `operations_sweep` — conceptual operations queue
- `analytics_admin` — conceptual analytics queue

## Key Design Features

### Duplicate-Run Protection
PostgreSQL advisory locks via `pg_try_advisory_lock`. Lock key is FNV-1a hash of job name (positive int64). Connection-scoped: released on function exit or connection close. Prevents concurrent execution across multiple API instances.

### Timezone-Aware Scheduling
Custom `tzSchedule` wrapper implements `cron.Schedule` interface, computing `Next()` in the target timezone. Default scheduler location is ICT (UTC+7) for Asia/Ho_Chi_Minh jobs; Asia/Tokyo jobs use `RegisterWithTimezone`.

### Config Toggle
- `JOBS_ENABLED=false` disables all Go jobs (scheduler is a no-op)
- `LOTO_AUTOPILOT_ENABLED=false` disables only Loto autopilot jobs
- Both default to `true`; mirrors NestJS `LOTO_AUTOPILOT_ENABLED` env var

### Structured Logging
Every job execution logs via slog: job name, trigger type, start/end timestamps (RFC3339 UTC), duration_ms, items_processed, error detail. Advisory lock skip logged at Debug level.

## Verification Results

All gates PASS:

```
go build ./...                    ✅
go test ./... -count=1            ✅ (all packages, including existing M1-M9 tests)
go test -race ./internal/jobs/... ✅
go vet ./...                      ✅
gofmt -l .                        ✅ (clean)
GOOS=linux GOARCH=arm64 go build  ✅
```

Integration test (`TestSchedulerIntegrationStartStop`) skips cleanly without `TEST_DATABASE_URL`.

## Acceptance Criteria Checklist

- [x] All known cron jobs have Go equivalents (stubs with TODO for business logic)
- [x] All known BullMQ queues have Go equivalents (stubs — no NestJS processors found)
- [x] Scheduler supports timezone-aware scheduling (ICT default + Asia/Tokyo via RegisterWithTimezone)
- [x] Duplicate-run protection via PostgreSQL advisory locks
- [x] Config toggle enables/disables Go jobs (JOBS_ENABLED, LOTO_AUTOPILOT_ENABLED)
- [x] Structured logging on every job execution (slog with job name, timestamps, duration, items, error)
- [x] Integration tests skip cleanly without TEST_DATABASE_URL
- [x] ALL static gates PASS: build, test, race, vet, gofmt, ARM64 cross-build
- [x] Code committed to main with descriptive commit message
- [x] Report written at docs/migrations/go-backend-v2/reports/M10_BACKGROUND_JOBS_REPORT.md

## Blockers / Future Work

- Business logic for all 10 cron handlers is stubbed (TODO comments reference NestJS service methods)
- Startup catchup (`@Timeout(30_000)` in NestJS LotoAutopilotCron) not implemented — can be added as a one-shot goroutine in app startup if needed
- Queue infrastructure will need Asynq/River when actual async producers/consumers are identified