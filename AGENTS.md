# AGENTS.md — NihonGo BJT Cursor Operating Guide

## AI quickstart

Read `AI_CONTEXT.md` first. It is the compact, current project brief for any AI assistant joining this repository. Then follow this file and all active Cursor rules.

## Mission

Build NihonGo BJT as a production-ready Japanese/BJT learning web app. The product must combine serious BJT preparation with joyful daily-life Japanese learning.

## Source of truth

Read these first:

1. `AI_CONTEXT.md`
2. `.github/instructions/production-first.instructions.md` — **MANDATORY before any code**
3. `docs/spec/index.md`
4. `docs/spec/nihongo_bjt_cursor_master_spec_final_completed_v2.md`
5. Read and follow all active Cursor rules in `.cursor/rules/*.mdc`.
6. `docs/cursor-prompts/*.xml`

## Non-negotiables

- PostgreSQL is the source of truth.
- Do not use MongoDB or Mongoose.
- Use Prisma for application database access unless a raw SQL migration is explicitly better.
- Search is a Meilisearch projection, not the source of truth.
- Redis/BullMQ handles background jobs.
- Socket.IO handles realtime battle flows.
- User-facing text must go through i18n keys.
- Admin writes require RBAC and audit logs.
- Media and external images require provenance/license metadata.
- Analytics must use real events and rollups, not fake charts.
- Monetization must use centralized entitlements, quotas, plans, and provider abstractions; never frontend-only paywall logic.
- Ads must be placement/config/provider-driven and must not interrupt core learning flows.

## Production-grade baseline: no demo code

Cursor must build minimal production-grade vertical slices, not demo screens. A feature is not done unless it has:

- typed domain model and API contract
- database persistence or an explicit provider abstraction
- validation and error handling
- RBAC/auth boundary when relevant
- i18n keys for all user-facing copy
- audit log for admin mutations
- tests for core business logic
- no fake in-memory state for persistent domain data
- no TODO-only placeholder replacing a required feature

Allowed temporary implementations:

- local/mock provider behind a provider interface when an external API key is unavailable
- seeded demo data only when clearly marked as seed/dev data and stored through the real schema
- minimal UI if it is connected to real APIs and real persistence

Forbidden shortcuts:

- storing important data only in React state/localStorage when it belongs in PostgreSQL
- hard-coded admin role checks scattered in UI only
- fake analytics charts not backed by event/rollup schema
- fake search arrays instead of Meilisearch projection or a compatible local provider
- direct raw JSON import into canonical content tables without staging/validation
- catching errors and silently ignoring them
- creating screens that look complete but cannot perform the workflow

## Working style

Before editing, write a short plan. After editing, run the relevant verification commands and summarize changed files, commands run, and remaining risks.

## Monetization baseline

Build monetization-ready architecture early, but do not over-integrate external providers before the core product is stable. Required baseline:

- plan, entitlement, quota, subscription, usage, and ad placement models
- server-side feature gating and quota enforcement
- admin management for plans, entitlements, quotas, subscriptions, ad placements, and monetization analytics
- local/dev billing and ad providers behind interfaces
- no scattered `isPremium` logic
- no frontend-only paywall enforcement
- respectful upgrade UX and no dark patterns

## Phase discipline

Implement one phase at a time. Do not jump ahead except for lightweight scaffolding needed to keep the app compiling.

## Social login and SNS sharing

- Implement social auth through provider abstractions and backend OAuth flows.
- Use privacy-safe public share pages and generated share postcards for achievements, BJT quiz results, daily phrases, and battle results.
- Do not expose private learning data in share URLs or OG metadata.
- Admin must be able to manage share templates, referral campaigns, and sharing analytics.

## Japanese Reading Assist Layer

The app must support learners who cannot read every Japanese word. Implement reading support as a reusable product layer, not page-specific demo tooltips. Any Japanese text component should be able to opt into hover/tap reading, furigana, meanings, and add-to-flashcard actions. Basic reading support must remain available to free users. Do not reveal meanings during active timed BJT exam mode unless it is practice/help mode or after answering.
