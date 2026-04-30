-- Refresh strategy: daily (content changes are moderate; MV supports CMS dashboards).
-- Heavy refresh acceptable off-peak; use CONCURRENTLY after unique index exists.
--
-- Perf: four heap scans (distinct entity tables); unavoidable without unified content table. FILTER used for review_reasons counts.
-- Each branch GROUP BY status only (minimal).

DROP MATERIALIZED VIEW IF EXISTS reporting.mv_content_quality_analytics CASCADE;

CREATE MATERIALIZED VIEW reporting.mv_content_quality_analytics AS
SELECT
  'lexeme'::text AS entity_type,
  l.status,
  count(*)::bigint AS entity_count,
  count(*) FILTER (WHERE l.review_reasons IS NOT NULL)::bigint AS with_review_reasons_json
FROM content.lexeme l
GROUP BY l.status
UNION ALL
SELECT
  'kanji'::text,
  k.status,
  count(*)::bigint,
  count(*) FILTER (WHERE k.review_reasons IS NOT NULL)::bigint
FROM content.kanji k
GROUP BY k.status
UNION ALL
SELECT
  'grammar'::text,
  g.status,
  count(*)::bigint,
  count(*) FILTER (WHERE g.review_reasons IS NOT NULL)::bigint
FROM content.grammar_point g
GROUP BY g.status
UNION ALL
SELECT
  'example'::text,
  e.status,
  count(*)::bigint,
  count(*) FILTER (WHERE e.review_reasons IS NOT NULL)::bigint
FROM content.example_sentence e
GROUP BY e.status;

COMMENT ON MATERIALIZED VIEW reporting.mv_content_quality_analytics IS
  'Content inventory by entity type and status; review_reasons presence via FILTER.';
