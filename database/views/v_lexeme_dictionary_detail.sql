-- JSON aggregation: jsonb_agg runs on at most 5 example rows per sense (subquery LIMIT).
-- Cost scales with (lexeme_senses selected × lateral); for full-corpus exports prefer ETL or a materialized table.
-- Index: examples are ordered by source_example_key — use leading column of content.uq_lexeme_sense_example_source (sense_id, source_example_key).
CREATE OR REPLACE VIEW reporting.v_lexeme_dictionary_detail AS
SELECT
  l.id AS lexeme_id,
  l.headword,
  l.reading AS lexeme_reading,
  l.jlpt_level,
  l.short_meaning_vi,
  l.kanji_meaning_vi,
  l.pronunciation,
  l.status AS lexeme_status,
  ls.id AS sense_id,
  ls.position AS sense_position,
  ls.part_of_speech,
  ls.meaning_vi AS sense_meaning_vi,
  ls.field AS sense_field,
  ls.metadata AS sense_metadata,
  ex.examples_json
FROM content.lexeme l
JOIN content.lexeme_sense ls ON ls.lexeme_id = l.id
LEFT JOIN LATERAL (
  SELECT
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'example_sentence_id', sub.es_id,
          'japanese_text', sub.japanese_text,
          'reading', sub.reading,
          'translation_vi', sub.translation_vi
        )
        ORDER BY sub.ord_key
      )
      FILTER (WHERE sub.es_id IS NOT NULL),
      '[]'::jsonb
    ) AS examples_json
  FROM (
    SELECT
      es.id AS es_id,
      es.japanese_text,
      es.reading,
      es.translation_vi,
      lse.source_example_key AS ord_key
    FROM content.lexeme_sense_example lse
    LEFT JOIN content.example_sentence es ON es.id = lse.example_sentence_id
    WHERE lse.sense_id = ls.id
    ORDER BY lse.source_example_key
    LIMIT 5
  ) sub
) ex ON TRUE;

COMMENT ON VIEW reporting.v_lexeme_dictionary_detail IS
  'Dictionary denormalization: one row per lexeme sense; examples JSON capped at 5 links per sense.';
