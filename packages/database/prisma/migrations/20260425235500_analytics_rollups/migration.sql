ALTER TABLE analytics.analytics_event
  ADD COLUMN IF NOT EXISTS anonymous_id varchar(120),
  ADD COLUMN IF NOT EXISTS session_id varchar(120);

CREATE INDEX IF NOT EXISTS idx_analytics_event_anonymous_created_at
  ON analytics.analytics_event (anonymous_id, created_at);

CREATE TABLE analytics.daily_metric (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date date NOT NULL,
  metric_name varchar(120) NOT NULL,
  dimension_type varchar(80) NOT NULL DEFAULT 'global',
  dimension_key varchar(120) NOT NULL DEFAULT 'all',
  value double precision NOT NULL,
  computed_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_daily_metric_dimension
  ON analytics.daily_metric (metric_date, metric_name, dimension_type, dimension_key);

CREATE INDEX idx_daily_metric_name_date
  ON analytics.daily_metric (metric_name, metric_date);

CREATE TABLE analytics.rollup_run (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'running',
  window_start timestamptz(6) NOT NULL,
  window_end timestamptz(6) NOT NULL,
  metrics integer NOT NULL DEFAULT 0,
  details jsonb,
  started_at timestamptz(6) NOT NULL DEFAULT now(),
  completed_at timestamptz(6)
);

CREATE INDEX idx_rollup_run_name_started_at ON analytics.rollup_run (name, started_at);
CREATE INDEX idx_rollup_run_status ON analytics.rollup_run (status);
