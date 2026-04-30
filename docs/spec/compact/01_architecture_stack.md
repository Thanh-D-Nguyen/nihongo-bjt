# Compact Spec 01: Architecture and Stack

## Canonical references

Full spec sections: 2, 3, 4, 5, 9, 11, 15, 16.

## Stack

- PostgreSQL is the source of truth.
- Prisma is the default application database access layer.
- Raw SQL migrations are allowed when Prisma cannot express the required database behavior cleanly.
- Meilisearch is a projection for search, not canonical storage.
- Redis/BullMQ handles background jobs.
- Socket.IO handles realtime battle flows.
- Do not introduce MongoDB/Mongoose.

## Monorepo expectations

Keep app boundaries explicit:
- backend API application
- learner frontend
- admin frontend
- shared contracts/types/i18n where the repo already supports them
- infrastructure/config/docs

Use existing package layout and scripts before inventing new structure.

## Bounded contexts

Expected backend domains:
- auth/user/profile/session
- content dictionary/kanji/grammar/examples
- search projection
- bookmarks
- flashcards/decks/SRS
- study/progress/achievements
- BJT quiz/mock exam
- battle realtime and REST history
- admin CMS/import/enrichment/audit/IAM/analytics
- media/provenance/licensing
- monetization/entitlement/quota/ads/billing providers
- privacy/consent/export/delete
- reading assist
- learning paths
- notifications/operations

## Architectural rules

- Keep a modular monolith unless explicitly directed otherwise.
- Do not duplicate services/routes/models for the same concept.
- Backend contracts own business rules; frontend may optimize UX but must not be the authority.
- External services must sit behind provider abstractions.
- Background work must be idempotent and observable.
- Realtime battle state must be coordinated through Socket.IO plus durable persistence for results/audit-relevant history.
- Search sync must be projection/outbox/checkpoint based where possible.

## Search

- Canonical content lives in PostgreSQL.
- Meilisearch indexes must be rebuildable from PostgreSQL.
- PostgreSQL fallback search can exist but must be clearly treated as degraded/local-compatible behavior.

## Battle

- Socket.IO owns realtime flows: lobby, challenge/matchmaking, room events, answers, timers, result publication.
- REST owns historical data, battle setup where appropriate, and admin/reporting surfaces.
- Anti-cheat/fairness logic belongs server-side.

## Background jobs

- Use Redis/BullMQ for imports, enrichment, search sync, analytics rollups, notifications, media processing, exports, and dead-letter recovery.
- Jobs need retries, idempotency keys or deterministic inputs, structured errors, and observability.

## Provider boundaries

Use provider interfaces for:
- billing
- ads
- social auth
- email
- malware scanning
- external image/search providers
- object storage/CDN
- tokenization/reading assist
- notifications

Local/dev providers are allowed when external credentials are absent, but they must be explicit and must not masquerade as production integrations.

## Frontend boundaries

- Learner UI owns learner experience and client-side ergonomics.
- Admin UI owns operational workflows and RBAC-aware presentation.
- Shared UI/contracts should be reused when repo patterns already exist.
- Frontend must not become the source of truth for permissions, entitlements, analytics, progress, or payment state.

## Data flow rules

- Canonical writes go to PostgreSQL through backend APIs or trusted jobs.
- Search, cache, analytics rollups, and UI summaries are derived from canonical records.
- Rebuildable projections should have clear source, checkpoint, and retry behavior.
- High-risk cross-module writes should emit auditable events where the repo supports them.

## Architecture review checklist

- Does one module clearly own the model?
- Is the source of truth PostgreSQL?
- Are projections rebuildable?
- Are provider abstractions used for external dependencies?
- Are auth/RBAC/entitlement rules server-side?
- Is failure mode explicit and observable?
- Is the change small enough for a single review?
