# AI_CONTEXT.md - NihonGo BJT Project Brief

This is the first file any AI assistant should read before changing this repository. It is a compact map of the product, architecture, non-negotiables, and current working conventions.

## Product

NihonGo BJT is a production-grade Japanese and BJT learning platform. It combines serious BJT preparation with daily-life Japanese learning, reading support, gamified practice, and admin-managed content workflows.

The product must not ship as demo-only UI. A feature is considered done only when the real vertical slice exists: typed model and API contract, persistence or provider abstraction, validation, auth/RBAC when relevant, i18n keys, audit logging for admin mutations, and focused tests for core logic.

## Read These Next

1. `AGENTS.md` - local operating guide and hard rules.
2. `docs/spec/index.md` - current spec map and source-of-truth index.
3. `docs/spec/nihongo_bjt_cursor_master_spec_final_completed_v2.md` - canonical full product spec.
4. `.cursor/rules/*.mdc` - active Cursor rules.
5. `README.md` - local setup, services, and scripts.
6. `DESIGN.md`, `.ai-design/`, and `docs/design/` - active design system and design references.
7. `docs/cursor-prompts/*.xml` - phase prompts and implementation guidance.

If docs disagree, prefer this order: current code and schema, `docs/spec/index.md`, canonical spec, active Cursor rules, then older supporting docs.

## Monorepo Map

- `apps/web` - learner-facing Next.js app.
- `apps/admin` - admin Next.js app for content, operations, and management workflows.
- `apps/api` - NestJS backend API.
- `packages/database` - Prisma schema, generated client, seed/migration support.
- `packages/shared` - shared TypeScript/Zod contracts and reusable domain types.
- `packages/ui` - shared UI building blocks.
- `.ai-design` - generated and curated visual design references.
- `.cursor/rules` - active coding and product rules for AI-assisted work.

## Core Architecture

- PostgreSQL is the source of truth.
- Prisma is the default application database access layer.
- Meilisearch is a search projection, not the source of truth.
- Redis and BullMQ handle background jobs.
- Socket.IO handles realtime battle flows.
- Keycloak is the auth provider in local/dev architecture.
- Object/media storage uses provider abstractions and must carry provenance/license metadata for external assets.

Do not introduce MongoDB, Mongoose, fake canonical search arrays, or frontend-only persistence for domain data that belongs in PostgreSQL.

## Non-Negotiables

- User-facing copy must go through i18n keys.
- Admin writes require backend authorization, RBAC boundaries, and audit logs.
- Analytics must use real events and rollups, not fake chart data.
- Monetization must use centralized plans, entitlements, quotas, subscriptions, usage, and provider abstractions.
- Paywall and quota enforcement must happen server-side. Do not scatter `isPremium` checks in UI.
- Ads must be placement/config/provider-driven and must not interrupt core learning flows.
- Social sharing must use privacy-safe public share pages and must not expose private learning data in URLs or OG metadata.
- Japanese Reading Assist must be a reusable product layer. Any Japanese text component should be able to opt into furigana, meanings, hover/tap reading, and add-to-flashcard actions. Do not reveal meanings during active timed BJT exam mode unless practice/help mode or after answering.

## Current Feature Areas

Recent work expanded several production slices. Before editing them, inspect the actual code paths and shared contracts:

- Card generation and cardgen admin workflows.
- Practice exercises, sessions, attempts, and learner progress.
- Gamification, XP, streaks, leaderboards, companion state, and achievements.
- Learner homepage and practice UI refreshes.
- NHK/news ingestion and learner-facing news sections.
- Admin management screens for practice/content operations.

## Verification Commands

Use focused commands first, then broader checks when the change has wider blast radius.

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm prisma:validate`
- `pnpm prisma:generate` after Prisma schema changes
- `pnpm build` before declaring broad app changes complete

For frontend work, run the relevant dev server and visually verify changed pages when practical.

## Working Rules For AI Agents

- Read before editing. Prefer `rg` and existing local patterns.
- Keep changes scoped to the requested feature or fix.
- Do not restore files the user intentionally deleted unless explicitly asked.
- Do not revert user changes. Work with the current dirty tree.
- Use provider interfaces for unavailable external services instead of hard-coded mocks.
- Use seed/dev data only through real schemas and mark it clearly as seed/dev data.
- Avoid TODO-only placeholders for required product behavior.
- Do not silently swallow errors.
- Commit in logical groups when asked to leave the workspace clean.
- Do not commit generated noise such as `*.tsbuildinfo`, rejected patches, or temporary scratch files.

## Useful Orientation

When joining mid-stream, start with:

```bash
git status --short
rg --files | rg 'AGENTS|AI_CONTEXT|docs/spec/index|schema.prisma|package.json'
pnpm lint
pnpm typecheck
```

Then inspect the feature-specific app, API module, shared contract, Prisma model, i18n messages, and tests before making edits.
