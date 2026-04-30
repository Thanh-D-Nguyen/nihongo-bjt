-- Meilisearch / search worker projection: same shape as apps/api/scripts/index-search.ts documents.
--
-- Perf: UNION ALL of four filtered base-table scans (no join explosion). At very large scale, incremental index jobs should read partitions or staging tables rather than this view in hot paths.

CREATE OR REPLACE VIEW reporting.v_content_search_documents AS
SELECT
  l.id,
  'lexeme'::text AS kind,
  l.headword AS title,
  l.reading,
  coalesce(l.short_meaning_vi, s0.meaning_vi) AS description
FROM content.lexeme l
LEFT JOIN LATERAL (
  SELECT ls.meaning_vi
  FROM content.lexeme_sense ls
  WHERE ls.lexeme_id = l.id
  ORDER BY ls.position ASC
  LIMIT 1
) s0 ON TRUE
WHERE l.status = 'active'
UNION ALL
SELECT
  k.id,
  'kanji'::text,
  k.character,
  concat_ws(' / ', k.onyomi, k.kunyomi) AS reading,
  k.meaning_vi
FROM content.kanji k
WHERE k.status = 'active'
UNION ALL
SELECT
  g.id,
  'grammar'::text,
  g.pattern,
  g.jlpt_level,
  g.meaning_vi
FROM content.grammar_point g
WHERE g.status = 'active'
UNION ALL
SELECT
  e.id,
  'example'::text,
  e.japanese_text,
  e.reading,
  e.translation_vi
FROM content.example_sentence e
WHERE e.status = 'active';

COMMENT ON VIEW reporting.v_content_search_documents IS
  'Unified search documents for Meilisearch `content_search` index (id, kind, title, reading, description).';
