-- Migration: 005_clean_corrupted_glosses
-- Idempotent dictionary gloss cleanup (C6) and BJT lesson text localization (D4).

-- 1. Fix verified botanical, medical, and scientific mistranslations in content.lexeme
UPDATE content.lexeme
SET short_meaning_vi = 'chi hoa Christmas rose (chi Helleborus)',
    updated_at = NOW()
WHERE headword = 'クリスマスローズ属'
  AND short_meaning_vi IS DISTINCT FROM 'chi hoa Christmas rose (chi Helleborus)';

UPDATE content.lexeme
SET short_meaning_vi = 'hoa Christmas rose (Helleborus)',
    updated_at = NOW()
WHERE headword = 'クリスマスローズ'
  AND short_meaning_vi IS DISTINCT FROM 'hoa Christmas rose (Helleborus)';

UPDATE content.lexeme
SET short_meaning_vi = 'chi cúc Callilepis',
    updated_at = NOW()
WHERE headword = 'Callilepis属'
  AND short_meaning_vi = 'viêm mô tế bào';

UPDATE content.lexeme
SET short_meaning_vi = 'chi hoa sữa (chi Alstonia)',
    updated_at = NOW()
WHERE headword = 'アルストニア属'
  AND short_meaning_vi = 'chi vi khuẩn ralstonia';

UPDATE content.lexeme
SET short_meaning_vi = 'bố trí nhân sự chéo; biệt phái qua lại',
    updated_at = NOW()
WHERE headword = '相互配属'
  AND short_meaning_vi = 'chéo qua đính kèm';

UPDATE content.lexeme
SET short_meaning_vi = 'chi họ hàng gần (sinh học)',
    updated_at = NOW()
WHERE headword = '近縁属'
  AND short_meaning_vi ILIKE '%những tiền đồng có liên hệ%';

UPDATE content.lexeme
SET short_meaning_vi = 'bộ phận trực thuộc; cấp dưới',
    updated_at = NOW()
WHERE headword = '部属'
  AND short_meaning_vi ILIKE '%gán cho những mục%';

UPDATE content.lexeme
SET short_meaning_vi = 'bệnh Crohn (viêm ruột mạn tính)',
    updated_at = NOW()
WHERE headword = 'クローン病'
  AND short_meaning_vi LIKE 'bệnh crohn có thể ảnh hưởng đến bất kỳ phần nào của đ%';

UPDATE content.lexeme
SET short_meaning_vi = 'bệnh Hodgkin (u lympho Hodgkin)',
    updated_at = NOW()
WHERE headword = 'ホジキン病'
  AND short_meaning_vi LIKE 'n) hodgkin%';

-- 2. Sync content.lexeme_sense for the repaired entries above
DELETE FROM content.lexeme_sense
WHERE lexeme_id IN (
  SELECT id FROM content.lexeme WHERE headword IN ('クリスマスローズ属', 'クリスマスローズ')
)
AND (
  meaning_vi ILIKE '%thiết khoái tử%'
  OR meaning_vi ILIKE '%cây trị điên%'
  OR meaning_vi ILIKE '%cây lê lư%'
);

UPDATE content.lexeme_sense s
SET meaning_vi = 'chi hoa Christmas rose (chi Helleborus)',
    position = 1
FROM content.lexeme l
WHERE s.lexeme_id = l.id
  AND l.headword = 'クリスマスローズ属';

INSERT INTO content.lexeme_sense (id, lexeme_id, position, meaning_vi, created_at)
SELECT gen_random_uuid(), l.id, 1, l.short_meaning_vi, NOW()
FROM content.lexeme l
WHERE l.headword IN ('クリスマスローズ属', 'クリスマスローズ')
  AND NOT EXISTS (SELECT 1 FROM content.lexeme_sense s WHERE s.lexeme_id = l.id);

UPDATE content.lexeme_sense s
SET meaning_vi = l.short_meaning_vi
FROM content.lexeme l
WHERE s.lexeme_id = l.id
  AND l.headword IN ('Callilepis属', 'アルストニア属', '相互配属', '近縁属', '部属', 'クローン病', 'ホジキン病')
  AND s.position = 1;

-- 3. Deactivate pure LLM refusal / construction-industry prompt-leak entries in content.lexeme
UPDATE content.lexeme
SET status = 'inactive',
    updated_at = NOW()
WHERE status = 'active'
  AND (
    short_meaning_vi ILIKE '%cannot provide a translation%'
    OR short_meaning_vi ILIKE '%cannot provide an accurate translation%'
    OR short_meaning_vi ILIKE '%does not have a clear meaning in vietnamese%'
    OR short_meaning_vi ILIKE '%do not have a specific translation in vietnamese%'
    OR short_meaning_vi ILIKE '%may not have a direct translation in vietnamese%'
    OR short_meaning_vi ILIKE '%i am not sure about the context%'
    OR short_meaning_vi ILIKE '%as an ai language model%'
    OR short_meaning_vi ILIKE '%i need more context to provide%'
    OR short_meaning_vi ILIKE '%seems to be in japanese%'
    OR short_meaning_vi ILIKE '%this translation is not specific to%'
    OR short_meaning_vi ILIKE '%this translation is based on the assumption%'
    OR short_meaning_vi ILIKE '%specific to the construction industry in japan%'
    OR short_meaning_vi ILIKE '%different meanings depending on the context in the construction industry%'
    OR short_meaning_vi ILIKE '%not a specialized word or phrase in the construction industry%'
    OR short_meaning_vi ILIKE '%không có thông tin đủ để dịch%'
    OR short_meaning_vi ILIKE '%không có thông tin đầy đủ về thuật ngữ%'
    OR short_meaning_vi ILIKE '%vui lòng cung cấp thêm thông tin%'
    OR short_meaning_vi ILIKE '%vui lòng cung cấp thêm ngữ cảnh%'
  );

-- 4. Strip trailing unmatched closing parentheses ("chi epilobium )" -> "chi epilobium")
UPDATE content.lexeme
SET short_meaning_vi = trim(regexp_replace(short_meaning_vi, '[\s;；]*\)+$', '')),
    updated_at = NOW()
WHERE status = 'active'
  AND short_meaning_vi ~ '\)+$'
  AND short_meaning_vi !~ '\(';

UPDATE content.lexeme_sense
SET meaning_vi = trim(regexp_replace(meaning_vi, '[\s;；]*\)+$', ''))
WHERE meaning_vi ~ '\)+$'
  AND meaning_vi !~ '\(';

-- 5. Fix typo domain tag "ddịa chất" -> "(địa chất)" and remove broken "nghĩa mỹ)" / "nghĩa cổ)" fragments
UPDATE content.lexeme
SET short_meaning_vi = regexp_replace(
      regexp_replace(short_meaning_vi, 'ddịa chất\)?', '(địa chất)', 'gi'),
      '(?:^|[;；]\s*)(?:nghĩa mỹ|nghĩa cổ|nghĩa bóng)\s*\)\s*[;；]?\s*',
      '; ',
      'gi'
    ),
    updated_at = NOW()
WHERE status = 'active'
  AND (short_meaning_vi ILIKE '%ddịa chất%' OR short_meaning_vi ~* '(nghĩa mỹ|nghĩa cổ|nghĩa bóng)\s*\)');

DELETE FROM content.lexeme_sense
WHERE meaning_vi ~* '^(nghĩa mỹ|nghĩa cổ|nghĩa bóng)\s*\)$';

-- 6. Collapse repeated semicolons "; ;" and leading/trailing semicolons in content.lexeme
UPDATE content.lexeme
SET short_meaning_vi = trim(both '; ' FROM regexp_replace(short_meaning_vi, '(;\s*){2,}', '; ', 'g')),
    updated_at = NOW()
WHERE status = 'active'
  AND short_meaning_vi ~ '(;\s*){2,}|^\s*;|;\s*$';

-- 7. Purge unreferenced exercise.exercise cache rows that contain corrupted glosses
DELETE FROM exercise.exercise e
WHERE e.source_type = 'lexeme'
  AND NOT EXISTS (
    SELECT 1 FROM exercise.exercise_session s WHERE e.id = ANY(s.exercise_ids)
  )
  AND (
    e.choices::text ILIKE '%thiết khoái tử%'
    OR e.choices::text ILIKE '%cây trị điên%'
    OR e.choices::text ILIKE '%cây lê lư%'
    OR e.choices::text ILIKE '%construction industry%'
    OR e.choices::text ILIKE '%in vietnamese%'
    OR e.choices::text ILIKE '%nghĩa mỹ)%'
    OR e.choices::text ~ '\s+\)"'
  );
