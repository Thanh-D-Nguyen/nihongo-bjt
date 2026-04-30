-- SRS-style due counts per learner (user_profile.id).
CREATE OR REPLACE VIEW reporting.v_flashcard_due_summary_per_user AS
SELECT
  uf.user_id,
  count(*)::bigint AS tracked_cards,
  count(*) FILTER (WHERE uf.due_at <= now())::bigint AS due_now_count,
  count(*) FILTER (WHERE uf.state = 'new')::bigint AS state_new_count,
  min(uf.due_at) FILTER (WHERE uf.due_at > now()) AS next_due_at
FROM learning.user_flashcard uf
GROUP BY uf.user_id;

COMMENT ON VIEW reporting.v_flashcard_due_summary_per_user IS
  'Per-user flashcard queue: total tracked cards, count due now (due_at <= transaction timestamp), new state count, next future due.';
