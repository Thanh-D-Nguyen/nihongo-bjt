-- Refresh strategy: align with analytics rollup (daily_core_metrics) — refresh after rollup job completes.
-- Source: analytics.daily_metric global slice (same inputs as apps/api/scripts/rollup-analytics.ts).
--
-- Perf: GROUP BY metric_date only; aggregates use FILTER (not CASE). metric_date is DATE — no cast.

DROP MATERIALIZED VIEW IF EXISTS reporting.mv_learning_engagement_daily_summary CASCADE;

CREATE MATERIALIZED VIEW reporting.mv_learning_engagement_daily_summary AS
SELECT
  dm.metric_date AS metric_date,
  coalesce(max(dm.value) FILTER (WHERE dm.metric_name = 'flashcards.reviews'), 0)::double precision AS flashcard_reviews,
  coalesce(max(dm.value) FILTER (WHERE dm.metric_name = 'flashcards.rating.again'), 0)::double precision AS flashcard_rating_again,
  coalesce(max(dm.value) FILTER (WHERE dm.metric_name = 'flashcards.rating.hard'), 0)::double precision AS flashcard_rating_hard,
  coalesce(max(dm.value) FILTER (WHERE dm.metric_name = 'flashcards.rating.good'), 0)::double precision AS flashcard_rating_good,
  coalesce(max(dm.value) FILTER (WHERE dm.metric_name = 'learner.active_users'), 0)::double precision AS learner_active_users,
  coalesce(max(dm.value) FILTER (WHERE dm.metric_name = 'assessment.answers'), 0)::double precision AS assessment_answers,
  coalesce(max(dm.value) FILTER (WHERE dm.metric_name = 'assessment.correct_answers'), 0)::double precision AS assessment_correct_answers,
  coalesce(max(dm.value) FILTER (WHERE dm.metric_name = 'assessment.accuracy_pct'), 0)::double precision AS assessment_accuracy_pct,
  coalesce(max(dm.value) FILTER (WHERE dm.metric_name = 'assessment.sessions_completed'), 0)::double precision AS assessment_sessions_completed,
  coalesce(max(dm.value) FILTER (WHERE dm.metric_name = 'content.search_events'), 0)::double precision AS search_events,
  coalesce(max(dm.value) FILTER (WHERE dm.metric_name = 'ops.admin_writes'), 0)::double precision AS admin_writes
FROM analytics.daily_metric dm
WHERE dm.dimension_type = 'global'
  AND dm.dimension_key = 'all'
GROUP BY dm.metric_date;

COMMENT ON MATERIALIZED VIEW reporting.mv_learning_engagement_daily_summary IS
  'Wide daily engagement snapshot pivoted from rollup metrics (FILTER aggregates per day).';
