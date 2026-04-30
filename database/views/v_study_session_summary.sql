-- Quiz session rollups per user (BJT practice / mock tests).
CREATE OR REPLACE VIEW reporting.v_study_session_summary AS
SELECT
  qs.user_id,
  count(*)::bigint AS sessions_started,
  count(*) FILTER (WHERE qs.status = 'completed')::bigint AS sessions_completed,
  coalesce(sum(qs.total_questions) FILTER (WHERE qs.status = 'completed'), 0)::bigint AS total_questions_completed_sessions,
  coalesce(sum(qs.correct_count) FILTER (WHERE qs.status = 'completed'), 0)::bigint AS total_correct_completed_sessions,
  max(qs.completed_at) AS last_completed_at
FROM assessment.quiz_session qs
GROUP BY qs.user_id;

COMMENT ON VIEW reporting.v_study_session_summary IS
  'Per-user quiz session stats: started vs completed, summed question/correct counts on completed sessions only.';
