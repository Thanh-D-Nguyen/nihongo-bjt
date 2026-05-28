-- Read path: single row from reporting view (no app-side join reimplementation).
-- Parameters: $1 = user_id (uuid).
-- Call from API via loadSqlFile + prisma.$queryRawUnsafe(sql, userId) or Prisma transaction.

SELECT
  user_id,
  flashcards_tracked,
  reviews_last_7d_utc,
  quiz_sessions_total,
  quiz_sessions_completed,
  battle_sessions_total
FROM reporting.v_user_learning_dashboard_summary
WHERE user_id = $1::uuid;
