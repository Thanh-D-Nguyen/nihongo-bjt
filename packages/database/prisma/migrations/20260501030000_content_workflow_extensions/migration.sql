-- Content workflow extensions: enrichment provenance/retry, version status/publication/revert.

-- ContentEnrichment additions: provider provenance, input snapshot, retry/cancel history.
ALTER TABLE "content"."content_enrichment"
  ADD COLUMN IF NOT EXISTS "input_snapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "provider"          VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "provider_license"  VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "provider_source"   TEXT,
  ADD COLUMN IF NOT EXISTS "attempts"          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "last_attempted_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "cancel_reason"     TEXT,
  ADD COLUMN IF NOT EXISTS "retry_history"     JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS "idx_content_enrichment_status_created"
  ON "content"."content_enrichment" ("status", "created_at");

-- ContentVersion additions: explicit publish lifecycle + revert lineage.
ALTER TABLE "content"."content_version"
  ADD COLUMN IF NOT EXISTS "published_at"             TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "reverted_from_version_id" UUID;

-- Existing rows used 'current' as default; map them to 'published' for the new lifecycle.
UPDATE "content"."content_version"
   SET "status" = 'published'
 WHERE "status" = 'current';

ALTER TABLE "content"."content_version"
  ALTER COLUMN "status" SET DEFAULT 'draft';

CREATE INDEX IF NOT EXISTS "idx_content_version_status_created"
  ON "content"."content_version" ("status", "created_at");
