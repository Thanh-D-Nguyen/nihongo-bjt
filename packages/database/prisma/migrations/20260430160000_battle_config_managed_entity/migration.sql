-- Managed battle mode/arena configuration entity. The previous "Battle Configs" admin surface only
-- exposed code-defined system parameters (`BATTLE_BOT_PROFILES`, `defaultMaxRounds`, etc.); operators
-- need a real CRUD entity for arenas with name/level/question pool/scoring/lifecycle so we can run
-- multiple battle modes without redeploys. Lives in `learning` alongside `battle_session`.

CREATE TABLE "learning"."battle_config" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "level" VARCHAR(32) NOT NULL,
    "question_pool_key" VARCHAR(64) NOT NULL,
    "question_count" INTEGER NOT NULL,
    "time_per_question_sec" INTEGER NOT NULL,
    "max_participants" INTEGER NOT NULL,
    "bot_difficulties" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "scoring_rules" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "status" VARCHAR(16) NOT NULL DEFAULT 'draft',
    "schedule_start" TIMESTAMPTZ(6),
    "schedule_end" TIMESTAMPTZ(6),
    "published_at" TIMESTAMPTZ(6),
    "archived_at" TIMESTAMPTZ(6),
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "battle_config_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_battle_config_status_level" ON "learning"."battle_config" ("status", "level");
CREATE INDEX "idx_battle_config_updated_at" ON "learning"."battle_config" ("updated_at");
