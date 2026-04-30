-- Refresh strategy: hourly or daily. Depends on analytics.analytics_event ingestion for content_search_submitted.
-- Payload: learner_web sends resultCount (see apps/web/.../search-client.tsx).
--
-- Perf: GROUP BY 1 keeps a single evaluation of the UTC date bucket in the planner.
-- Scale: when analytics_event exceeds ~50–100M rows, partition by RANGE(created_at) monthly and refresh MV per partition or rebuild from a rollup table — see indexes/underlying_support_reporting_views.sql.

DROP MATERIALIZED VIEW IF EXISTS reporting.mv_search_quality_daily CASCADE;

CREATE MATERIALIZED VIEW reporting.mv_search_quality_daily AS
SELECT
  (ae.created_at AT TIME ZONE 'UTC')::date AS metric_date,
  count(*)::bigint AS search_submissions,
  count(*) FILTER (
    WHERE ae.payload ? 'resultCount'
      AND (ae.payload ->> 'resultCount')::int = 0
  )::bigint AS zero_result_submissions,
  avg((ae.payload ->> 'resultCount')::numeric) FILTER (WHERE ae.payload ? 'resultCount') AS avg_result_count
FROM analytics.analytics_event ae
WHERE ae.event_name = 'content_search_submitted'
GROUP BY 1;

COMMENT ON MATERIALIZED VIEW reporting.mv_search_quality_daily IS
  'Search quality by UTC day: submissions, zero-result count (payload.resultCount = 0), avg hits.';
