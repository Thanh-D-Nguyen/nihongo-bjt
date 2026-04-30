-- Perf: one grouped scan per fact table + hash joins to user_profile (avoids O(users × 5) correlated counts).
-- Trade-off: snapshot-style counts; suitable for admin/ops dashboards, not real-time gamification.
CREATE OR REPLACE VIEW reporting.v_user_learning_dashboard_summary AS
SELECT
  up.id AS user_id,
  coalesce(uf.flashcards_tracked, 0)::bigint AS flashcards_tracked,
  coalesce(rev.reviews_last_7d_utc, 0)::bigint AS reviews_last_7d_utc,
  coalesce(qs.quiz_sessions_total, 0)::bigint AS quiz_sessions_total,
  coalesce(qs.quiz_sessions_completed, 0)::bigint AS quiz_sessions_completed,
  coalesce(bs.battle_sessions_total, 0)::bigint AS battle_sessions_total
FROM profile.user_profile up
LEFT JOIN (
  SELECT uf.user_id, count(*)::bigint AS flashcards_tracked
  FROM learning.user_flashcard uf
  GROUP BY uf.user_id
) uf ON uf.user_id = up.id
LEFT JOIN (
  SELECT re.user_id, count(*)::bigint AS reviews_last_7d_utc
  FROM learning.review_event re
  WHERE re.reviewed_at >= (now() AT TIME ZONE 'UTC') - interval '7 days'
  GROUP BY re.user_id
) rev ON rev.user_id = up.id
LEFT JOIN (
  SELECT
    q.user_id,
    count(*)::bigint AS quiz_sessions_total,
    count(*) FILTER (WHERE q.status = 'completed')::bigint AS quiz_sessions_completed
  FROM assessment.quiz_session q
  GROUP BY q.user_id
) qs ON qs.user_id = up.id
LEFT JOIN (
  SELECT b.user_id, count(*)::bigint AS battle_sessions_total
  FROM learning.battle_session b
  GROUP BY b.user_id
) bs ON bs.user_id = up.id
WHERE up.status = 'active';

COMMENT ON VIEW reporting.v_user_learning_dashboard_summary IS
  'Dashboard rollups per active user: pre-aggregated joins (flashcards, reviews 7d UTC, quiz, battle). Scales linearly in table sizes, not profile count × subqueries.';
