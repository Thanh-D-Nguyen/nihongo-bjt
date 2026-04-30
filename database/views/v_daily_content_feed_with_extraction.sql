-- Daily Hub items with optional extraction row (1:1 on daily_learning_extraction.daily_content_item_id).
-- Perf: simple LEFT JOIN on PK/FK; ensure index on daily_learning_extraction(daily_content_item_id) — unique in Prisma.

CREATE OR REPLACE VIEW reporting.v_daily_content_feed_with_extraction AS
SELECT
  i.id AS daily_content_item_id,
  i.widget_kind,
  i.content_date,
  i.locale,
  i.title,
  i.body_md,
  i.japanese_text,
  i.reading_text,
  i.explanation_text,
  i.source_provider,
  i.source_ref,
  i.payload AS item_payload,
  i.status,
  i.created_at,
  i.updated_at,
  e.id AS extraction_id,
  e.extracted_entries,
  e.extracted_kanji,
  e.extracted_grammar,
  e.suggested_flashcards,
  e.suggested_quiz,
  e.created_at AS extraction_created_at,
  (e.id IS NOT NULL) AS has_extraction
FROM daily.daily_content_item i
LEFT JOIN daily.daily_learning_extraction e ON e.daily_content_item_id = i.id;

COMMENT ON VIEW reporting.v_daily_content_feed_with_extraction IS
  'Daily content with learning extraction JSON; join is PK-aligned.';
