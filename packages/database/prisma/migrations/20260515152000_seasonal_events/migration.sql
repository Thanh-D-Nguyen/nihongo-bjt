CREATE TABLE "gamification"."seasonal_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(60) NOT NULL,
    "name_vi" VARCHAR(100) NOT NULL,
    "name_ja" VARCHAR(100),
    "description" VARCHAR(500),
    "icon_emoji" VARCHAR(10) NOT NULL DEFAULT '🎏',
    "banner_color" VARCHAR(20) NOT NULL DEFAULT '#f0abfc',
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "seasonal_event_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "seasonal_event_slug_key" ON "gamification"."seasonal_event"("slug");
CREATE INDEX "idx_seasonal_event_dates" ON "gamification"."seasonal_event"("start_date", "end_date", "active");

CREATE TABLE "gamification"."event_challenge" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(500),
    "challenge_type" VARCHAR(30) NOT NULL,
    "target_value" INTEGER NOT NULL,
    "reward_xp" INTEGER NOT NULL DEFAULT 0,
    "reward_badge" VARCHAR(50),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "event_challenge_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "event_challenge_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "gamification"."seasonal_event"("id") ON DELETE CASCADE
);
CREATE INDEX "idx_event_challenge_order" ON "gamification"."event_challenge"("event_id", "sort_order");

CREATE TABLE "gamification"."event_participant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "event_participant_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "event_participant_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "gamification"."seasonal_event"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "uq_event_participant" ON "gamification"."event_participant"("event_id", "user_id");

CREATE TABLE "gamification"."event_challenge_progress" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "challenge_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "current_value" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "event_challenge_progress_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "event_challenge_progress_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "gamification"."event_challenge"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "uq_event_challenge_progress" ON "gamification"."event_challenge_progress"("challenge_id", "user_id");
CREATE INDEX "idx_event_progress_user" ON "gamification"."event_challenge_progress"("user_id", "completed");

-- Seed a sample event
INSERT INTO "gamification"."seasonal_event" (slug, name_vi, name_ja, description, icon_emoji, banner_color, start_date, end_date) VALUES
  ('sakura-sprint-2026', 'Sakura Sprint 🌸', '桜スプリント', 'Hoàn thành 7 thử thách trong 14 ngày để nhận huy hiệu Sakura!', '🌸', '#fbb6ce', '2026-05-15', '2026-05-29');

INSERT INTO "gamification"."event_challenge" (event_id, title, description, challenge_type, target_value, reward_xp, sort_order) VALUES
  ((SELECT id FROM "gamification"."seasonal_event" WHERE slug = 'sakura-sprint-2026'), 'Ôn tập 50 thẻ', 'Ôn tập 50 flashcard', 'reviews', 50, 30, 1),
  ((SELECT id FROM "gamification"."seasonal_event" WHERE slug = 'sakura-sprint-2026'), 'Hoàn thành 3 quiz', 'Hoàn thành 3 bài quiz BJT', 'quizzes', 3, 50, 2),
  ((SELECT id FROM "gamification"."seasonal_event" WHERE slug = 'sakura-sprint-2026'), 'Streak 5 ngày', 'Giữ streak 5 ngày liên tục', 'streak_days', 5, 40, 3),
  ((SELECT id FROM "gamification"."seasonal_event" WHERE slug = 'sakura-sprint-2026'), 'Focus 60 phút', 'Tổng thời gian tập trung 60 phút', 'focus_minutes', 60, 35, 4),
  ((SELECT id FROM "gamification"."seasonal_event" WHERE slug = 'sakura-sprint-2026'), 'Học 20 thẻ mới', 'Thêm 20 thẻ flashcard mới', 'new_cards', 20, 45, 5);
