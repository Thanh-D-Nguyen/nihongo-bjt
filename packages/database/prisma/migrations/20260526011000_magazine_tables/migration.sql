-- Daily magazine content tables.
-- Completes the schema changes introduced with the magazine module without resetting local data.

CREATE TABLE IF NOT EXISTS daily.magazine_article (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(200) NOT NULL UNIQUE,
  widget_kind VARCHAR(64) NOT NULL,
  content_date DATE NOT NULL,
  locale VARCHAR(16) NOT NULL DEFAULT 'vi',
  title_jp TEXT NOT NULL,
  title_vi TEXT NOT NULL,
  summary_jp TEXT,
  summary_vi TEXT,
  cover_image_url TEXT,
  content_json JSONB NOT NULL DEFAULT '{}',
  jlpt_level VARCHAR(8),
  source_data_json JSONB DEFAULT '{}',
  ai_model VARCHAR(64),
  generation_cost_tokens INTEGER,
  seo_title TEXT,
  seo_description TEXT,
  og_image_url TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ(6),
  expires_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily.magazine_vocab_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL,
  word_jp TEXT NOT NULL,
  reading TEXT NOT NULL,
  meaning_vi TEXT NOT NULL,
  pos VARCHAR(32),
  jlpt_level VARCHAR(8),
  sentence_jp TEXT,
  sentence_vi TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily.magazine_quiz (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL,
  question_jp TEXT NOT NULL,
  question_vi TEXT,
  quiz_type VARCHAR(32) NOT NULL DEFAULT 'multiple_choice',
  options JSONB NOT NULL DEFAULT '[]',
  correct_answer TEXT NOT NULL,
  explanation_jp TEXT,
  explanation_vi TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily.magazine_user_read (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  article_id UUID NOT NULL,
  read_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  quiz_score INTEGER,
  quiz_total INTEGER,
  vocab_saved_count INTEGER NOT NULL DEFAULT 0,
  time_spent_seconds INTEGER
);

CREATE INDEX IF NOT EXISTS idx_magazine_article_public
  ON daily.magazine_article (status, content_date DESC, locale);

CREATE INDEX IF NOT EXISTS idx_magazine_article_kind
  ON daily.magazine_article (widget_kind, status, content_date DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_magazine_kind_date_locale
  ON daily.magazine_article (widget_kind, content_date, locale);

CREATE INDEX IF NOT EXISTS idx_magazine_vocab_article_order
  ON daily.magazine_vocab_item (article_id, display_order);

CREATE INDEX IF NOT EXISTS idx_magazine_quiz_article_order
  ON daily.magazine_quiz (article_id, display_order);

CREATE INDEX IF NOT EXISTS idx_magazine_user_read_user
  ON daily.magazine_user_read (user_id, read_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_magazine_user_article
  ON daily.magazine_user_read (user_id, article_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'magazine_vocab_item_article_id_fkey'
  ) THEN
    ALTER TABLE daily.magazine_vocab_item
      ADD CONSTRAINT magazine_vocab_item_article_id_fkey
      FOREIGN KEY (article_id) REFERENCES daily.magazine_article(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'magazine_quiz_article_id_fkey'
  ) THEN
    ALTER TABLE daily.magazine_quiz
      ADD CONSTRAINT magazine_quiz_article_id_fkey
      FOREIGN KEY (article_id) REFERENCES daily.magazine_article(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'magazine_user_read_article_id_fkey'
  ) THEN
    ALTER TABLE daily.magazine_user_read
      ADD CONSTRAINT magazine_user_read_article_id_fkey
      FOREIGN KEY (article_id) REFERENCES daily.magazine_article(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
