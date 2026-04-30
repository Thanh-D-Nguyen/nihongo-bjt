# Compact Spec 02: Database and Prisma

## Canonical references

Full spec sections: 6, 7, 8, 26.5, 28.7, 29.4.

## Principles

- PostgreSQL is canonical.
- Prisma is the default application access layer.
- Use raw SQL migrations for extensions, indexes, partitions, triggers, generated columns, or constraints Prisma cannot model cleanly.
- No MongoDB/Mongoose.
- Prefer normalized relational models for canonical content and operational records.

## Schemas and table families

Keep table ownership clear across these families:
- auth/user/profile/session/account linking
- content dictionary, kanji, grammar, examples, tags, translations
- import staging, import batches, errors, canonical upsert tracking
- search outbox/sync checkpoints
- bookmarks
- flashcards, decks, SRS reviews, remediation links
- study progress, achievements, learning analytics events and rollups
- BJT levels, quiz items, sessions, answers, mock exams, results
- battle rooms, players, answers, results, anti-cheat records
- admin audit, RBAC, IAM, support access
- media assets, provenance, license metadata, transformations
- monetization plans, entitlements, quotas, subscriptions, usage, ad placements, billing events
- privacy consent, export/delete requests, legal documents
- reading assist tokens, dictionary links, parsing cache, user interactions
- learning paths, competencies, milestones, assignments, progress
- notifications, feature flags, operational events

## Import and staging rules

- Raw source files are not canonical until staged, validated, and imported.
- Imports must be idempotent using deterministic source keys.
- Invalid records must be retained in import errors/dead-letter style storage.
- Stream large source files; avoid loading huge JSON fully into memory.
- Media and external images require provenance/license metadata before use.

## Prisma rules

- Keep enum naming stable and explicit.
- Add relations and indexes intentionally; do not rely on implicit scans for common admin/search/reporting queries.
- Migration changes that affect existing data need rollback or forward-fix notes.
- Do not bypass Prisma in application code unless raw SQL is justified by performance or database feature need.

## Index and partition strategy

Index:
- foreign keys used in joins
- unique source keys
- slug/key fields
- tenant/user/time filters
- admin list filters
- analytics event dimensions
- outbox/job status fields

Partition candidates:
- analytics events
- audit logs
- job/dead-letter logs
- high-volume battle/quiz answer events
- usage/billing events

Use partitioning only when the repo has migration support and query patterns justify it.

## Monetization data

Required models include plans, entitlements, quotas, subscriptions, usage counters, ad placements/configs, billing events, webhook events/dead letters, and provider identifiers. Frontend premium state is never canonical.

## Reading assist data

Support reusable parsing/token data, reading/furigana/meaning references, add-to-flashcard flows, interaction analytics, and admin quality review.

## Learning path data

Support path definitions, competencies, milestones, assignments, adaptive progress, remediation links, and analytics events.

## Schema review checklist

- Does each new table have a clear owning module?
- Are IDs, timestamps, and lifecycle/status fields consistent with repo conventions?
- Are unique constraints present for natural/source keys?
- Are foreign keys indexed when used in joins or filters?
- Are enum values explicit and stable?
- Are soft-delete, retention, or anonymization needs considered?
- Is sensitive data minimized and access-gated?
- Is migration additive unless a data migration plan exists?

## Migration safety

For existing tables:
- avoid destructive changes without explicit approval
- add nullable columns before backfilling/enforcing constraints
- document backfill strategy
- consider lock impact for large tables
- verify rollback or forward-fix path
- keep seed/dev data separate from production assumptions

## Query and API alignment

Before adding schema:
- identify API endpoints that write/read it
- identify admin operations and audit requirements
- identify learner-facing privacy exposure
- identify analytics events/rollups derived from it
- identify search projection needs
- identify quota/entitlement linkage if monetized

## Raw SQL allowed cases

Use raw SQL migrations for:
- PostgreSQL extensions
- partial/expression indexes
- GIN/GiST indexes
- generated columns
- partitioning
- triggers
- database policies/constraints Prisma cannot express

Raw SQL should still be documented and reflected in application assumptions.
