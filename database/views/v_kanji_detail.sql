-- Perf: one pass per child table via grouped LEFT JOINs (no repeated index lookups per kanji row).
CREATE OR REPLACE VIEW reporting.v_kanji_detail AS
SELECT
  k.id AS kanji_id,
  k.character,
  k.meaning_vi,
  k.onyomi,
  k.kunyomi,
  k.stroke_count,
  k.level,
  k.frequency,
  k.detail,
  k.tip,
  k.status,
  coalesce(ke.example_count, 0)::bigint AS example_count,
  coalesce(kc.component_count, 0)::bigint AS component_count
FROM content.kanji k
LEFT JOIN (
  SELECT kanji_id, count(*)::bigint AS example_count
  FROM content.kanji_example
  GROUP BY kanji_id
) ke ON ke.kanji_id = k.id
LEFT JOIN (
  SELECT kanji_id, count(*)::bigint AS component_count
  FROM content.kanji_component
  GROUP BY kanji_id
) kc ON kc.kanji_id = k.id;

COMMENT ON VIEW reporting.v_kanji_detail IS
  'Kanji row with example/component counts from pre-aggregated child joins (scales to full kanji table scans).';
