-- Phase 13: Japanese reading assist (cache, preferences, user reports for admin)
CREATE TABLE learning.reading_text_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text_hash char(64) NOT NULL,
  result_json jsonb NOT NULL,
  tokenizer_version varchar(32) NOT NULL DEFAULT 'kuromoji-1',
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT uq_reading_text_analysis_hash UNIQUE (text_hash)
);
CREATE INDEX idx_reading_text_analysis_updated ON learning.reading_text_analysis (updated_at);

CREATE TABLE learning.reading_assist_report (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profile.user_profile(id) ON DELETE SET NULL,
  kind varchar(32) NOT NULL,
  text_hash char(64) NOT NULL,
  context varchar(200),
  created_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE INDEX idx_reading_assist_report_kind_created ON learning.reading_assist_report (kind, created_at);
CREATE INDEX idx_reading_assist_report_user_created ON learning.reading_assist_report (user_id, created_at);

CREATE TABLE profile.reading_user_preference (
  user_id uuid PRIMARY KEY REFERENCES profile.user_profile(id) ON DELETE CASCADE,
  display_mode varchar(32) NOT NULL DEFAULT 'hover',
  show_romaji boolean NOT NULL DEFAULT false,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now()
);
