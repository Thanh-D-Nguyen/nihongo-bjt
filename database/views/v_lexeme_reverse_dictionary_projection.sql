-- Perf: example_link_count from grouped join over lexeme_reverse_candidate_example (not per-row correlated count).
CREATE OR REPLACE VIEW reporting.v_lexeme_reverse_dictionary_projection AS
SELECT
  p.id AS projection_id,
  p.vietnamese_headword,
  p.status AS projection_status,
  c.id AS candidate_id,
  c.position AS candidate_position,
  c.part_of_speech,
  c.japanese_text,
  c.reading,
  c.kanji_text,
  c.metadata AS candidate_metadata,
  coalesce(ec.example_link_count, 0)::bigint AS example_link_count
FROM content.lexeme_reverse_projection p
JOIN content.lexeme_reverse_candidate c ON c.projection_id = p.id
LEFT JOIN (
  SELECT candidate_id, count(*)::bigint AS example_link_count
  FROM content.lexeme_reverse_candidate_example
  GROUP BY candidate_id
) ec ON ec.candidate_id = c.id;

COMMENT ON VIEW reporting.v_lexeme_reverse_dictionary_projection IS
  'Reverse dictionary candidates with pre-aggregated example link counts.';
