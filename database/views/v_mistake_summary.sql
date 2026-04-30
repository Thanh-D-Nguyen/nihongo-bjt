-- Perf: skill_tag is functionally dependent on question_id (FK to bjt_question); GROUP BY user + question only.
-- Uses max(skill_tag) as a cheap stand-in for ANY_VALUE (stable per question id).
CREATE OR REPLACE VIEW reporting.v_mistake_summary AS
SELECT
  qs.user_id,
  'quiz'::text AS source,
  qa.question_id,
  max(q.skill_tag) AS skill_tag,
  count(*)::bigint AS wrong_attempts
FROM assessment.quiz_answer qa
JOIN assessment.quiz_session qs ON qs.id = qa.session_id
JOIN assessment.bjt_question q ON q.id = qa.question_id
WHERE qa.is_correct = false
GROUP BY qs.user_id, qa.question_id
UNION ALL
SELECT
  bs.user_id,
  'battle'::text AS source,
  br.question_id,
  max(q.skill_tag) AS skill_tag,
  count(*)::bigint
FROM learning.battle_round br
JOIN learning.battle_session bs ON bs.id = br.session_id
JOIN assessment.bjt_question q ON q.id = br.question_id
WHERE br.user_correct = false
GROUP BY bs.user_id, br.question_id;

COMMENT ON VIEW reporting.v_mistake_summary IS
  'Wrong quiz answers and battle rounds aggregated by user and question; skill_tag via max() (single value per question_id).';
