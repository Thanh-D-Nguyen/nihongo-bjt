CREATE SCHEMA IF NOT EXISTS daily;

CREATE TABLE daily.daily_widget_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_kind varchar(64) NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  min_level varchar(16),
  max_level varchar(16),
  locale varchar(16) NOT NULL DEFAULT 'vi',
  settings jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_daily_widget_config_kind_locale
  ON daily.daily_widget_config (widget_kind, locale);
CREATE INDEX idx_daily_widget_config_enabled_order
  ON daily.daily_widget_config (enabled, display_order);

CREATE TABLE daily.daily_content_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_config_id uuid REFERENCES daily.daily_widget_config(id) ON DELETE SET NULL,
  widget_kind varchar(64) NOT NULL,
  content_date date NOT NULL,
  locale varchar(16) NOT NULL,
  title text NOT NULL,
  body_md text,
  japanese_text text,
  reading_text text,
  explanation_text text,
  source_provider varchar(80),
  source_ref text,
  payload jsonb NOT NULL DEFAULT '{}',
  status varchar(32) NOT NULL DEFAULT 'published',
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_daily_content_kind_date_locale_source
  ON daily.daily_content_item (widget_kind, content_date, locale, source_ref);
CREATE INDEX idx_daily_content_date_locale_status
  ON daily.daily_content_item (content_date, locale, status);
CREATE INDEX idx_daily_content_kind_status
  ON daily.daily_content_item (widget_kind, status);

CREATE TABLE daily.daily_learning_extraction (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_content_item_id uuid NOT NULL UNIQUE REFERENCES daily.daily_content_item(id) ON DELETE CASCADE,
  extracted_entries jsonb NOT NULL DEFAULT '[]',
  extracted_kanji jsonb NOT NULL DEFAULT '[]',
  extracted_grammar jsonb NOT NULL DEFAULT '[]',
  suggested_flashcards jsonb NOT NULL DEFAULT '[]',
  suggested_quiz jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE TABLE daily.daily_user_action (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  daily_content_item_id uuid NOT NULL REFERENCES daily.daily_content_item(id) ON DELETE CASCADE,
  action_type varchar(64) NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE INDEX idx_daily_user_action_user_created_at
  ON daily.daily_user_action (user_id, created_at);
CREATE INDEX idx_daily_user_action_item_type
  ON daily.daily_user_action (daily_content_item_id, action_type);
