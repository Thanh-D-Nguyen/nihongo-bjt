-- Perf: single aggregate pass for detail rows; second pass only for rows that have example links (join on detail_id).
CREATE OR REPLACE VIEW reporting.v_grammar_detail AS
SELECT
  g.id AS grammar_point_id,
  g.pattern,
  g.meaning_vi,
  g.jlpt_level,
  g.category,
  g.status,
  coalesce(dc.detail_count, 0)::bigint AS detail_count,
  coalesce(dex.link_count, 0)::bigint AS detail_example_link_count
FROM content.grammar_point g
LEFT JOIN (
  SELECT grammar_point_id, count(*)::bigint AS detail_count
  FROM content.grammar_point_detail
  GROUP BY grammar_point_id
) dc ON dc.grammar_point_id = g.id
LEFT JOIN (
  SELECT d.grammar_point_id, count(*)::bigint AS link_count
  FROM content.grammar_point_detail d
  JOIN content.grammar_point_detail_example ge ON ge.detail_id = d.id
  GROUP BY d.grammar_point_id
) dex ON dex.grammar_point_id = g.id;

COMMENT ON VIEW reporting.v_grammar_detail IS
  'Grammar point with detail_count and example-link counts via two grouped joins (avoids double-scanning details per scalar subquery pattern).';
