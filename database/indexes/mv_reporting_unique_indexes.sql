-- Unique indexes required for REFRESH MATERIALIZED VIEW CONCURRENTLY.
-- Apply after creating materialized views (see database/materialized_views/).

CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_admin_daily_kpi_summary_dim
  ON reporting.mv_admin_daily_kpi_summary (metric_date, metric_name);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_content_quality_analytics_dim
  ON reporting.mv_content_quality_analytics (entity_type, status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_search_quality_daily_dim
  ON reporting.mv_search_quality_daily (metric_date);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_learning_engagement_daily_dim
  ON reporting.mv_learning_engagement_daily_summary (metric_date);

-- Optional supporting indexes for common filters (non-unique)
CREATE INDEX IF NOT EXISTS idx_mv_admin_kpi_metric_date
  ON reporting.mv_admin_daily_kpi_summary (metric_date DESC);

CREATE INDEX IF NOT EXISTS idx_mv_search_quality_metric_date
  ON reporting.mv_search_quality_daily (metric_date DESC);
