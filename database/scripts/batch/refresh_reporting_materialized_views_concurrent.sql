-- Refresh all reporting materialized views (concurrent; each statement autocommits).
-- REFRESH ... CONCURRENTLY cannot run inside a transaction block in PostgreSQL.
--
-- Scheduling: cron, systemd timer, or BullMQ recurring job after analytics rollup.

REFRESH MATERIALIZED VIEW CONCURRENTLY reporting.mv_admin_daily_kpi_summary;
REFRESH MATERIALIZED VIEW CONCURRENTLY reporting.mv_content_quality_analytics;
REFRESH MATERIALIZED VIEW CONCURRENTLY reporting.mv_search_quality_daily;
REFRESH MATERIALIZED VIEW CONCURRENTLY reporting.mv_learning_engagement_daily_summary;

-- Non-concurrent fallback (e.g. initial load before unique indexes exist):
-- See batch/refresh_reporting_materialized_views_non_concurrent.sql
