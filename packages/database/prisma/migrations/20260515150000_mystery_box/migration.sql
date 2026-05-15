-- Mystery Box rewards table
CREATE TABLE "gamification"."mystery_box_reward" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(50) NOT NULL,
    "name_vi" VARCHAR(100) NOT NULL,
    "name_ja" VARCHAR(100),
    "description" VARCHAR(255),
    "reward_type" VARCHAR(30) NOT NULL,
    "reward_value" INTEGER NOT NULL DEFAULT 0,
    "rarity" VARCHAR(20) NOT NULL DEFAULT 'common',
    "icon_emoji" VARCHAR(10) NOT NULL DEFAULT '🎁',
    "weight" INTEGER NOT NULL DEFAULT 100,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mystery_box_reward_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "mystery_box_reward_slug_key" ON "gamification"."mystery_box_reward"("slug");
CREATE INDEX "idx_mystery_reward_active" ON "gamification"."mystery_box_reward"("active", "weight");

-- Mystery Box claims table
CREATE TABLE "gamification"."mystery_box_claim" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "reward_id" UUID NOT NULL,
    "claimed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claim_date" DATE NOT NULL,
    CONSTRAINT "mystery_box_claim_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "mystery_box_claim_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "gamification"."mystery_box_reward"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "uq_mystery_claim_user_day" ON "gamification"."mystery_box_claim"("user_id", "claim_date");
CREATE INDEX "idx_mystery_claim_user" ON "gamification"."mystery_box_claim"("user_id", "claimed_at");

-- Seed default rewards
INSERT INTO "gamification"."mystery_box_reward" (slug, name_vi, name_ja, reward_type, reward_value, rarity, icon_emoji, weight) VALUES
  ('xp_10', '+10 XP', '+10 XP', 'xp', 10, 'common', '✨', 300),
  ('xp_25', '+25 XP', '+25 XP', 'xp', 25, 'common', '⭐', 200),
  ('xp_50', '+50 XP', '+50 XP', 'xp', 50, 'uncommon', '🌟', 100),
  ('xp_100', '+100 XP', '+100 XP', 'xp', 100, 'rare', '💫', 30),
  ('streak_freeze', 'Streak Freeze', 'ストリークフリーズ', 'streak_freeze', 1, 'uncommon', '🧊', 80),
  ('review_boost', 'Ôn tập x2 (1h)', '復習2倍(1時間)', 'review_boost', 60, 'uncommon', '🚀', 60),
  ('badge_lucky', 'Huy hiệu May Mắn', 'ラッキーバッジ', 'badge', 1, 'rare', '🍀', 20),
  ('badge_star', 'Huy hiệu Ngôi Sao', 'スターバッジ', 'badge', 1, 'epic', '🏅', 8),
  ('pet_hat', 'Mũ cho Pet', 'ペットの帽子', 'pet_costume', 1, 'rare', '🎩', 15),
  ('pet_scarf', 'Khăn cho Pet', 'ペットのスカーフ', 'pet_costume', 1, 'epic', '🧣', 5);
