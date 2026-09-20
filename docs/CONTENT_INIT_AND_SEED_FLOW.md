# Content Initialization & Seed Flow

Version: 1.0 (2026-09-17)

## Goals

1. A fresh environment (empty DB after migrations) becomes fully usable by running
   **one authoritative bootstrap command**.
2. Re-running the bootstrap never duplicates content and never deletes runtime or
   user-created data (quiz answers, battle rounds, sessions, user progress).
3. Dataset changes are detected via a content fingerprint, so canonical content
   can be updated safely.

## Architecture decision

```
prisma migrate deploy          (DB migrations — schema)
        ↓
pnpm bootstrap:content          (content bootstrap — data, idempotent)
        ↓
app startup                     (API / web / admin — assumes content present)
```

**No seeding happens on application startup.** Production restarts must not
touch learning data. The bootstrap is an explicit, re-runnable step in
provisioning/deployment, exactly like a migration.

### Why not the existing `seed:bjt` script?

`database/scripts/seeds/bjt/seed-bjt-production.ts` is a *destructive replace*:
it deletes `QuizAnswer`, `BattleRound`, `QuizSession`, then the tests, and
recreates them with fresh UUIDs. That is appropriate as a one-time dev reset,
but it:

- destroys runtime data on every run,
- changes question IDs, orphaning anything that referenced them by ID
  (image assets keyed by question, review state),
- is not safe to run concurrently.

The bootstrap (`database/scripts/bootstrap/bootstrap-bjt-content.ts`) instead
performs **slug-keyed upserts** (the same pattern `seed-foundation.ts` and
`seed-bjt-lessons.ts` already use):

| Entity | Stable key | Behavior on re-run |
| --- | --- | --- |
| BjtMockTest | `slug` (unique) | upsert metadata |
| BjtTestSection | `(testId, code)` (unique) | upsert metadata |
| BjtQuestion | `qualityFlags.stableId` = `bjt-j3-practice-v3:RC_VOCAB_GRAMMAR:0042` (matched within its section) | upsert all canonical fields, **same DB row/UUID preserved** |
| BjtQuestionOption | `(questionId, optionKey)` (unique) | upsert text/isCorrect |

`BjtQuestion.sourceId` is a UUID column in the schema, so the stable string key
lives in `qualityFlags.stableId` instead — no migration required.

### Stable question IDs

`BjtQuestion.sourceId` carries `bjt-j3-practice-v3:RC_VOCAB_GRAMMAR:0042`
(the same stable ID the audit uses). The bootstrap:

1. computes the expected question set from the TS seed files,
2. upserts each question by `sourceId`,
3. **never deletes** questions that are absent from the seed files — they are
   reported as `extraneous` for manual review (legacy `local-bjt-practice-01`
   falls into this bucket on first run).

### Dataset fingerprint

Each test's `blueprintMeta.datasetFingerprint` stores a SHA-256 over the
canonical question payloads (prompt/scenario/options/explanation/skillTag/
difficulty + mediaHint). On bootstrap:

- fingerprint unchanged → section skipped entirely (fast no-op re-run),
- fingerprint changed → questions diffed by `sourceId` and updated in place
  (IDs preserved, so image assets and review state survive).

## Commands

```bash
# Migrations (always first)
pnpm prisma migrate deploy

# Authoritative content bootstrap (idempotent, safe on prod)
pnpm bootstrap:content

# What it will do, without writing
pnpm bootstrap:content -- --dry-run

# Verify only (checks fingerprint consistency, missing images, referential integrity)
pnpm bootstrap:content -- --verify-only
```

Exit code is non-zero when verification fails, so CI/deploy can gate on it.

## Relation to existing seed scripts

- `seed:foundation`, `seed:bjt-lessons`, etc. remain valid dev tools; they are
  already upsert-based or clearly scoped.
- `seed:bjt` (destructive) remains for **dev-only full resets** and is not part
  of the bootstrap path. Its header states this.
- `bootstrap:content` currently covers the BJT question datasets (practice v3
  + official mocks). Other content domains (decks, daily, radar, magazine,
  career-rpg) are added incrementally by calling their (upsert-safe) seed
  functions from the same orchestrator.

## Safety properties (tested)

- Re-running bootstrap twice: zero duplicate questions, zero changed IDs.
- Bootstrap does not touch rows in `QuizAnswer`, `BattleRound`, `QuizSession`,
  `Exercise*`, review state, or anything with `ownerUserId`.
- Non-local `DATABASE_URL` requires `ALLOW_REMOTE_TARGET=true` (same guard the
  image scripts use).