# Magazine duplicate cleanup (runbook)

Duplicate published `daily.magazine_article` rows (same kind, locale, Vietnamese
title and `content_json`) come from the seed scripts (`pnpm seed:magazine`, still unchanged: re-running them on a later day republishes the same entries under new dates; fixing them is MAG-003). `internal/magazine` adds a
generator that rotates through content pools; wiring it into the
`magazine_generation` cron is a separate task (MAG-002), so until then the cron is
still a no-op.

`apps/api-go/cmd/magazine-dedupe` archives duplicates. It is **not** shipped in
the Docker image and the application never runs it; an operator runs it against
a reachable `DATABASE_URL` (for example through an SSH tunnel to production).

```bash
cd apps/api-go
DATABASE_URL=postgres://... go run ./cmd/magazine-dedupe            # dry run, changes nothing
DATABASE_URL=postgres://... go run ./cmd/magazine-dedupe -apply     # archive, keeping the latest of each group
```

Options: `-keep earliest`, `-kind magazine_vocab`.

Nothing is deleted (deleting would cascade into `magazine_user_read`). Archived rows
are hidden from the public API and carry `source_data_json.dedupedAt`. Restore with:

```sql
UPDATE daily.magazine_article
SET status='published', source_data_json = source_data_json - 'dedupedAt'
WHERE status='archived' AND source_data_json ? 'dedupedAt';
```

Content pools live in `apps/api-go/internal/magazine/pool/*.json`. They are small
(12 vocab themes, 3 BJT phrases) and the seeds already used every entry, so on
existing environments the generator finds no unused entry: it will publish nothing and
log a `content pool exhausted` WARN rather than creating a duplicate. Add entries
(append-only, never change a `key`) to resume daily publishing. Weather is
unscheduled until a seasonal pool exists.

Limits: seeded `magazine_loto` rows differ in `luckyNumbers`, so dedupe does not match them. Quiz options in the pools list the correct answer first and clients do not shuffle.
