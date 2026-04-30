-- Refresh strategy: after analytics.daily_metric rollup (e.g. apps/api/scripts/rollup-analytics.ts) or every 15–60m if ingesting late events.
-- Recommended scheduler: cron / systemd timer / BullMQ recurring job invoking database/scripts/batch/refresh_reporting_materialized_views_concurrent.sql
--
-- Perf: metric_date is already DATE in schema; no redundant ::date cast in GROUP BY.
-- Scale: daily_metric stays small (one row per metric per day); if non-global dimensions grow, consider partial MVs or BRIN on metric_date.

DROP MATERIALIZED VIEW IF EXISTS reporting.mv_admin_daily_kpi_summary CASCADE;

CREATE MATERIALIZED VIEW reporting.mv_admin_daily_kpi_summary AS
SELECT
  dm.metric_date AS metric_date,
  dm.metric_name,
  sum(dm.value)::double precision AS total_value
FROM analytics.daily_metric dm
WHERE dm.dimension_type = 'global'
  AND dm.dimension_key = 'all'
GROUP BY dm.metric_date, dm.metric_name;

COMMENT ON MATERIALIZED VIEW reporting.mv_admin_daily_kpi_summary IS
  'Long-format admin KPIs from analytics.daily_metric (global dimension only).';
