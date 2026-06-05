---
name: bjt-mobile-offline-sync-strategy
description: Design, audit, or implement the offline and sync strategy for the Nihongo BJT Flutter mobile app \u2014 drift-backed caching, write queueing, conflict handling, and connectivity-aware sync \u2014 so the app works offline without corrupting canonical PostgreSQL data. Use when adding offline support, local caching, or background sync to any mobile feature.
---

# BJT Mobile Offline & Sync Strategy Skill

Use this skill when designing, auditing, or implementing offline behavior and
data sync. Follow the `bjt-mobile-foundation-quality-gate` baseline.

## Goal

Let learners keep studying with degraded or no connectivity, then sync safely
when back online — without ever corrupting the server's canonical data.

## Core principle

`drift` is a **cache and an outbound queue**, not the source of truth.
PostgreSQL (via the API) is canonical. Sync reconciles toward the server.

## Hard rules

- Never present cached data as authoritative writes that bypass the server.
- Queue offline mutations; replay on reconnect with idempotent operations.
- Resolve conflicts with a defined, documented strategy (e.g., server-wins for
  canonical content; merge for additive review results). Never silently drop
  user work.
- Show connectivity state (`OfflineBanner`) and which data is stale/pending.
- Do not corrupt SRS schedule or progress on replay; ensure ordering/idempotency.
- No fake "synced" indicator. Reflect real queue/sync state.
- Keep VI/JA localization in sync. Support light/dark, 360–390 dp. Add/update
  tests.

## Required audit before coding

Inspect:
- which features need offline (lessons, flashcards/SRS, saved, content reading)
- web API idempotency/conflict semantics, models
- mobile drift schema, repositories, connectivity handling, existing cache
  patterns, providers, tests

Create/update:
- `docs/mobile/OFFLINE_SYNC_STRATEGY.md` (per-feature offline scope + conflict
  rules)
- `docs/mobile/OFFLINE_SYNC_CONTRACT.md`
- `docs/mobile/OFFLINE_SYNC_IMPLEMENTATION_PLAN.md`

## Required behavior

1. Connectivity-aware data layer: cache reads, queue writes.
2. Outbound mutation queue with idempotent replay on reconnect.
3. Documented conflict resolution per data type.
4. Stale/pending indicators in the UI.
5. Safe SRS/progress replay (ordering + idempotency).

## Required tests

- read from cache offline; banner shows offline
- mutation queued offline; replayed once on reconnect (idempotent)
- conflict resolved per documented rule; no lost user work
- SRS/progress replay preserves correctness
- pending/stale indicators reflect real queue state
- dark mode, 360 dp

## Verification

`cd apps/mobile && flutter analyze` · `flutter test` · `git diff --check`.
Stop if red. Report files changed, commands + results, and a note proving canonical
data cannot be corrupted by replay.
