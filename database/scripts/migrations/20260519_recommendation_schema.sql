-- Recommendation schema: onboarding preferences for cold-start users
-- This table stores user's initial preferences from the onboarding questionnaire

CREATE SCHEMA IF NOT EXISTS recommendation;

CREATE TABLE IF NOT EXISTS recommendation.onboarding_preferences (
  user_id       UUID PRIMARY KEY,
  current_level SMALLINT NOT NULL DEFAULT 3 CHECK (current_level BETWEEN 0 AND 5),
  goal          TEXT NOT NULL DEFAULT 'general',
  topics        TEXT[] NOT NULL DEFAULT '{}',
  daily_minutes SMALLINT NOT NULL DEFAULT 10 CHECK (daily_minutes BETWEEN 5 AND 120),
  style         TEXT NOT NULL DEFAULT 'mixed',
  completed     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- For tracking served items (dedup in recommendation pipeline)
CREATE TABLE IF NOT EXISTS recommendation.served_item (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL,
  item_id    TEXT NOT NULL,
  item_type  TEXT NOT NULL,
  pipeline   TEXT NOT NULL,
  served_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_served_item_user_recent
  ON recommendation.served_item (user_id, served_at DESC);

-- Auto-cleanup: remove served items older than 7 days (via scheduled job or trigger)
COMMENT ON TABLE recommendation.served_item IS 'Tracks items served to user for deduplication. Auto-prune after 7 days.';
COMMENT ON TABLE recommendation.onboarding_preferences IS 'User onboarding questionnaire answers. Used for cold-start recommendations.';
