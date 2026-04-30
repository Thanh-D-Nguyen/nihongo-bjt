CREATE TABLE IF NOT EXISTS learning.bookmark (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  target_type varchar(32) NOT NULL,
  target_id uuid NOT NULL,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT chk_bookmark_target_type CHECK (target_type IN ('word', 'lexeme', 'kanji', 'grammar'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bookmark_user_target
  ON learning.bookmark(user_id, target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_bookmark_user_type_created
  ON learning.bookmark(user_id, target_type, created_at DESC);
