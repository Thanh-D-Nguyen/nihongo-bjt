-- CreateTable
CREATE TABLE "exercise"."exercise_config" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "exercise_type" VARCHAR(32) NOT NULL,
    "placement" VARCHAR(32) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "min_level" VARCHAR(8),
    "max_level" VARCHAR(8),
    "time_limit_sec" INTEGER,
    "points_per_correct" INTEGER NOT NULL DEFAULT 10,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "exercise_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise"."exercise" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "exercise_type" VARCHAR(32) NOT NULL,
    "source_type" VARCHAR(32) NOT NULL,
    "source_id" UUID NOT NULL,
    "level" VARCHAR(8),
    "prompt" JSONB NOT NULL,
    "choices" JSONB NOT NULL DEFAULT '[]',
    "correct_answer" JSONB NOT NULL,
    "explanation" TEXT,
    "difficulty" VARCHAR(16) NOT NULL DEFAULT 'medium',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise"."exercise_session" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "session_type" VARCHAR(32) NOT NULL,
    "exercise_type" VARCHAR(32) NOT NULL,
    "level" VARCHAR(8),
    "status" VARCHAR(32) NOT NULL DEFAULT 'in_progress',
    "total_questions" INTEGER NOT NULL DEFAULT 0,
    "correct_count" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL DEFAULT 0,
    "streak_contribution" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "exercise_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise"."exercise_answer" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "exercise_id" UUID NOT NULL,
    "user_answer" JSONB NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "time_spent_ms" INTEGER NOT NULL DEFAULT 0,
    "answered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercise_answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gamification"."streak_config" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(128) NOT NULL,
    "activity_type" VARCHAR(32) NOT NULL,
    "min_actions_per_day" INTEGER NOT NULL DEFAULT 1,
    "freezes_allowed" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "streak_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gamification"."user_streak" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "streak_config_id" UUID NOT NULL,
    "current_streak" INTEGER NOT NULL DEFAULT 0,
    "longest_streak" INTEGER NOT NULL DEFAULT 0,
    "last_activity_date" DATE,
    "streak_start_date" DATE,
    "freezes_used" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_streak_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gamification"."achievement_definition" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(128) NOT NULL,
    "name_key" VARCHAR(255) NOT NULL,
    "description_key" VARCHAR(255) NOT NULL,
    "category" VARCHAR(32) NOT NULL,
    "metric_key" VARCHAR(64) NOT NULL,
    "icon_url" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "achievement_definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gamification"."achievement_tier" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "achievement_id" UUID NOT NULL,
    "tier" VARCHAR(16) NOT NULL,
    "threshold" INTEGER NOT NULL,
    "reward_type" VARCHAR(32),
    "reward_value" VARCHAR(255),
    "icon_url" TEXT,
    "name_key" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievement_tier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gamification"."user_achievement" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "achievement_id" UUID NOT NULL,
    "tier_id" UUID NOT NULL,
    "current_progress" INTEGER NOT NULL DEFAULT 0,
    "earned_at" TIMESTAMPTZ(6),
    "notified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gamification"."leaderboard_config" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(128) NOT NULL,
    "name_key" VARCHAR(255),
    "metric_type" VARCHAR(32) NOT NULL,
    "period" VARCHAR(16) NOT NULL,
    "max_entries" INTEGER NOT NULL DEFAULT 100,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "leaderboard_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gamification"."leaderboard_entry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "leaderboard_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "computed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leaderboard_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."flashcard_gen_rule" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(128) NOT NULL,
    "source_type" VARCHAR(32) NOT NULL,
    "filter_level" VARCHAR(8),
    "filter_tags" JSONB NOT NULL DEFAULT '[]',
    "direction" VARCHAR(16) NOT NULL DEFAULT 'both',
    "card_template" JSONB NOT NULL DEFAULT '{}',
    "include_examples" BOOLEAN NOT NULL DEFAULT true,
    "include_audio" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "flashcard_gen_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."flashcard_gen_job" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rule_id" UUID,
    "user_id" UUID,
    "mode" VARCHAR(32) NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "cards_generated" INTEGER NOT NULL DEFAULT 0,
    "deck_id" UUID,
    "params" JSONB NOT NULL DEFAULT '{}',
    "error_message" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flashcard_gen_job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_exercise_config_placement_order" ON "exercise"."exercise_config"("placement", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "uq_exercise_config_type_placement" ON "exercise"."exercise_config"("exercise_type", "placement");

-- CreateIndex
CREATE INDEX "idx_exercise_type_level" ON "exercise"."exercise"("exercise_type", "level");

-- CreateIndex
CREATE INDEX "idx_exercise_source" ON "exercise"."exercise"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "idx_exercise_session_user_status" ON "exercise"."exercise_session"("user_id", "status");

-- CreateIndex
CREATE INDEX "idx_exercise_session_user_started" ON "exercise"."exercise_session"("user_id", "started_at");

-- CreateIndex
CREATE INDEX "idx_exercise_answer_session" ON "exercise"."exercise_answer"("session_id", "answered_at");

-- CreateIndex
CREATE INDEX "idx_exercise_answer_exercise" ON "exercise"."exercise_answer"("exercise_id");

-- CreateIndex
CREATE INDEX "idx_user_streak_user_current" ON "gamification"."user_streak"("user_id", "current_streak");

-- CreateIndex
CREATE UNIQUE INDEX "uq_user_streak_user_config" ON "gamification"."user_streak"("user_id", "streak_config_id");

-- CreateIndex
CREATE UNIQUE INDEX "achievement_definition_slug_key" ON "gamification"."achievement_definition"("slug");

-- CreateIndex
CREATE INDEX "idx_achievement_def_category_order" ON "gamification"."achievement_definition"("category", "display_order");

-- CreateIndex
CREATE INDEX "idx_achievement_tier_threshold" ON "gamification"."achievement_tier"("achievement_id", "threshold");

-- CreateIndex
CREATE UNIQUE INDEX "uq_achievement_tier_achievement_tier" ON "gamification"."achievement_tier"("achievement_id", "tier");

-- CreateIndex
CREATE INDEX "idx_user_achievement_user_achievement" ON "gamification"."user_achievement"("user_id", "achievement_id");

-- CreateIndex
CREATE INDEX "idx_user_achievement_user_earned" ON "gamification"."user_achievement"("user_id", "earned_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_user_achievement_user_tier" ON "gamification"."user_achievement"("user_id", "tier_id");

-- CreateIndex
CREATE INDEX "idx_leaderboard_entry_board_period_rank" ON "gamification"."leaderboard_entry"("leaderboard_id", "period_start", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "uq_leaderboard_entry_board_user_period" ON "gamification"."leaderboard_entry"("leaderboard_id", "user_id", "period_start");

-- CreateIndex
CREATE INDEX "idx_flashcard_gen_rule_source_enabled" ON "learning"."flashcard_gen_rule"("source_type", "enabled");

-- CreateIndex
CREATE INDEX "idx_flashcard_gen_job_user_created" ON "learning"."flashcard_gen_job"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_flashcard_gen_job_status_created" ON "learning"."flashcard_gen_job"("status", "created_at");

-- AddForeignKey
ALTER TABLE "exercise"."exercise_answer" ADD CONSTRAINT "exercise_answer_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "exercise"."exercise_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise"."exercise_answer" ADD CONSTRAINT "exercise_answer_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercise"."exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gamification"."user_streak" ADD CONSTRAINT "user_streak_streak_config_id_fkey" FOREIGN KEY ("streak_config_id") REFERENCES "gamification"."streak_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gamification"."user_streak" ADD CONSTRAINT "user_streak_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profile"."user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gamification"."achievement_tier" ADD CONSTRAINT "achievement_tier_achievement_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "gamification"."achievement_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gamification"."user_achievement" ADD CONSTRAINT "user_achievement_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "gamification"."achievement_tier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gamification"."user_achievement" ADD CONSTRAINT "user_achievement_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profile"."user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gamification"."leaderboard_entry" ADD CONSTRAINT "leaderboard_entry_leaderboard_id_fkey" FOREIGN KEY ("leaderboard_id") REFERENCES "gamification"."leaderboard_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."flashcard_gen_job" ADD CONSTRAINT "flashcard_gen_job_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "learning"."flashcard_gen_rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
