-- Initial or migration-safe refresh (runs inside a transaction).
-- Use batch/refresh_reporting_materialized_views_concurrent.sql in production schedulers after unique indexes exist.

REFRESH MATERIALIZED VIEW reporting.mv_admin_daily_kpi_summary;
REFRESH MATERIALIZED VIEW reporting.mv_content_quality_analytics;
REFRESH MATERIALIZED VIEW reporting.mv_search_quality_daily;
REFRESH MATERIALIZED VIEW reporting.mv_learning_engagement_daily_summary;
