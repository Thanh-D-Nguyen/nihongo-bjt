-- Canonical content rows flagged for review (non-active status or review_reasons JSON set).
CREATE OR REPLACE VIEW reporting.v_content_moderation_queue AS
SELECT
  l.id AS entity_id,
  'lexeme'::text AS entity_type,
  l.headword AS label,
  l.status,
  l.review_reasons,
  l.updated_at
FROM content.lexeme l
WHERE l.status <> 'active'
   OR l.review_reasons IS NOT NULL
UNION ALL
SELECT
  k.id,
  'kanji'::text,
  k.character,
  k.status,
  k.review_reasons,
  k.updated_at
FROM content.kanji k
WHERE k.status <> 'active'
   OR k.review_reasons IS NOT NULL
UNION ALL
SELECT
  g.id,
  'grammar'::text,
  g.pattern,
  g.status,
  g.review_reasons,
  g.updated_at
FROM content.grammar_point g
WHERE g.status <> 'active'
   OR g.review_reasons IS NOT NULL
UNION ALL
SELECT
  e.id,
  'example'::text,
  left(e.japanese_text, 120),
  e.status,
  e.review_reasons,
  e.updated_at
FROM content.example_sentence e
WHERE e.status <> 'active'
   OR e.review_reasons IS NOT NULL;

COMMENT ON VIEW reporting.v_content_moderation_queue IS
  'CMS moderation queue: lexeme, kanji, grammar, example rows needing attention (status not active or review_reasons present).';
