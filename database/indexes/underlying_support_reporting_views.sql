-- Optional supporting indexes for reporting views / MV source tables (v_mistake_summary).
-- Production path: Prisma migration 20260426190000_reporting_views_materialized_views applies
-- the same indexes with CREATE INDEX (non-CONCURRENTLY) inside the migration transaction.
-- This file keeps CREATE INDEX CONCURRENTLY for zero-downtime manual runs outside a transaction.
--
-- Partitioning (manual migration when thresholds hit):
--   - analytics.analytics_event: PARTITION BY RANGE (created_at) monthly once row count or delete churn makes MV refresh scans costly.
--   - analytics.daily_metric: usually small; partition only if you add high-cardinality dimensions.
--   - monetization.usage_event: consider RANGE(created_at) if usage_event grows unbounded.
--
-- Note: v_lexeme_dictionary_detail lateral example fetch is already well served by
-- content.uq_lexeme_sense_example_source (sense_id, source_example_key); do not add a redundant sense_id-only btree.

-- v_mistake_summary (quiz branch): WHERE is_correct = false; partial index is small vs full table.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quiz_answer_incorrect_reporting
  ON assessment.quiz_answer (session_id, question_id)
  WHERE is_correct = false;

-- v_mistake_summary (battle branch): WHERE user_correct = false (NULL rows excluded, same as the view predicate).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_battle_round_user_wrong_reporting
  ON learning.battle_round (session_id, question_id)
  WHERE user_correct = false;

-- Search MV / event analytics: existing idx_analytics_event_name_created_at is usually enough.
-- Optional narrower partial index if search refresh dominates I/O:
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_event_search_submitted_reporting
--   ON analytics.analytics_event ((created_at AT TIME ZONE 'UTC'))
--   WHERE event_name = 'content_search_submitted';
