-- Flashcard Styles — cosmetic premium feature
-- Phase 1: Table + user preference column

CREATE TABLE IF NOT EXISTS learning.flashcard_style (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(64) NOT NULL UNIQUE,
  name_key VARCHAR(128) NOT NULL,
  description_key VARCHAR(128),
  thumbnail_url TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  tier VARCHAR(16) NOT NULL DEFAULT 'free',
  sort_order INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flashcard_style_tier_status_sort
  ON learning.flashcard_style (tier, status, sort_order);

-- Add active flashcard style slug to user profile
ALTER TABLE profile.user_profile
  ADD COLUMN IF NOT EXISTS flashcard_style_slug VARCHAR(64);

-- Seed entitlement definition for premium styles
INSERT INTO monetization.entitlement_definition (id, key, description, category)
VALUES (
  gen_random_uuid(),
  'flashcard.premium_styles',
  'Access to premium and exclusive flashcard visual styles',
  'flashcard'
)
ON CONFLICT (key) DO NOTHING;
