-- Polymorphic QA review log for human-curated content.
-- One row per state transition; the latest row per (entity_type, entity_id) is current state.

CREATE TABLE IF NOT EXISTS content.content_qa_review (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  VARCHAR(80) NOT NULL,
  entity_id    UUID NOT NULL,
  state        VARCHAR(32) NOT NULL,
  reviewer_id  UUID,
  comment      TEXT,
  version      INTEGER NOT NULL,
  created_at   TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_content_qa_entity_version
  ON content.content_qa_review (entity_type, entity_id, version);

CREATE INDEX IF NOT EXISTS idx_content_qa_type_state
  ON content.content_qa_review (entity_type, state, created_at);

CREATE INDEX IF NOT EXISTS idx_content_qa_entity
  ON content.content_qa_review (entity_type, entity_id);
