-- Companion pet costume ownership.

CREATE TABLE IF NOT EXISTS gamification.pet_costume_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  costume_slug VARCHAR(50) NOT NULL,
  obtained_from VARCHAR(30) NOT NULL DEFAULT 'mystery_box',
  obtained_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pet_costume_user_slug
  ON gamification.pet_costume_inventory (user_id, costume_slug);

CREATE INDEX IF NOT EXISTS idx_pet_costume_user
  ON gamification.pet_costume_inventory (user_id);
