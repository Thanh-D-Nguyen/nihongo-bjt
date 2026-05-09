CREATE SCHEMA IF NOT EXISTS "career";

CREATE TABLE "career"."career_rank" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rank_code" VARCHAR(8) NOT NULL,
    "title_ja" TEXT NOT NULL,
    "title_vi" TEXT NOT NULL,
    "bjt_band_target" VARCHAR(32) NOT NULL,
    "min_skill_floor" INTEGER NOT NULL DEFAULT 0,
    "required_arc_count" INTEGER NOT NULL DEFAULT 0,
    "xp_to_next" INTEGER NOT NULL DEFAULT 100,
    "unlocked_scene_types" JSONB NOT NULL,
    "rewards_payload" JSONB NOT NULL DEFAULT '{}',
    "display_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "career_rank_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "career"."user_career_state" (
    "user_id" UUID NOT NULL,
    "current_rank_code" VARCHAR(8) NOT NULL DEFAULT 'R1',
    "rank_xp" INTEGER NOT NULL DEFAULT 0,
    "jp_work_name" TEXT NOT NULL DEFAULT '田中 太郎',
    "company_theme" VARCHAR(80) NOT NULL DEFAULT 'mirai-shoji',
    "hire_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_clock_in_at" TIMESTAMPTZ(6),
    "streak_days" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_career_state_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "career"."career_skill_stat" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "axis_code" VARCHAR(32) NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "career_skill_stat_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "career"."rank_progression_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "from_rank_code" VARCHAR(8) NOT NULL,
    "to_rank_code" VARCHAR(8) NOT NULL,
    "trigger_event" VARCHAR(80) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rank_progression_event_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "career"."mission_arc" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "title_ja" TEXT NOT NULL,
    "title_vi" TEXT NOT NULL,
    "rank_code_entry" VARCHAR(8) NOT NULL,
    "story_payload" JSONB NOT NULL DEFAULT '{}',
    "status" VARCHAR(32) NOT NULL DEFAULT 'draft',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "mission_arc_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "career"."mission_chapter" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "arc_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title_ja" TEXT NOT NULL,
    "title_vi" TEXT NOT NULL,
    "briefing_payload" JSONB NOT NULL DEFAULT '{}',
    "reflection_payload" JSONB NOT NULL DEFAULT '{}',
    "is_boss" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "scenario_payload" JSONB NOT NULL DEFAULT '{}',
    "rewards_payload" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "mission_chapter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "career"."chapter_attempt" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "chapter_id" UUID NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'in_progress',
    "score_snapshot" JSONB,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "chapter_attempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "career"."story_npc" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "name_ja" TEXT NOT NULL,
    "role_ja" TEXT NOT NULL,
    "company_ja" TEXT,
    "default_relation" VARCHAR(16) NOT NULL DEFAULT 'uchi',
    "persona_prompt" TEXT,
    "avatar_media" JSONB,
    "status" VARCHAR(32) NOT NULL DEFAULT 'active',

    CONSTRAINT "story_npc_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "career"."npc_relation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "npc_slug" TEXT NOT NULL,
    "trust_score" INTEGER NOT NULL DEFAULT 50,
    "last_interaction_at" TIMESTAMPTZ(6),
    "memory_notes" JSONB,

    CONSTRAINT "npc_relation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "career_rank_rank_code_key" ON "career"."career_rank"("rank_code");
CREATE INDEX "idx_career_rank_display_order" ON "career"."career_rank"("display_order");
CREATE INDEX "idx_user_career_state_rank" ON "career"."user_career_state"("current_rank_code");
CREATE UNIQUE INDEX "uq_career_skill_stat_user_axis" ON "career"."career_skill_stat"("user_id", "axis_code");
CREATE INDEX "idx_career_skill_stat_axis" ON "career"."career_skill_stat"("axis_code");
CREATE INDEX "idx_rank_progression_event_user_created" ON "career"."rank_progression_event"("user_id", "created_at");
CREATE UNIQUE INDEX "mission_arc_slug_key" ON "career"."mission_arc"("slug");
CREATE INDEX "idx_mission_arc_status_order" ON "career"."mission_arc"("status", "display_order");
CREATE INDEX "idx_mission_arc_rank_entry" ON "career"."mission_arc"("rank_code_entry");
CREATE UNIQUE INDEX "uq_mission_chapter_arc_slug" ON "career"."mission_chapter"("arc_id", "slug");
CREATE INDEX "idx_mission_chapter_arc_order" ON "career"."mission_chapter"("arc_id", "display_order");
CREATE INDEX "idx_chapter_attempt_user_status_started" ON "career"."chapter_attempt"("user_id", "status", "started_at");
CREATE INDEX "idx_chapter_attempt_chapter" ON "career"."chapter_attempt"("chapter_id");
CREATE UNIQUE INDEX "story_npc_slug_key" ON "career"."story_npc"("slug");
CREATE INDEX "idx_story_npc_status" ON "career"."story_npc"("status");
CREATE UNIQUE INDEX "uq_npc_relation_user_npc" ON "career"."npc_relation"("user_id", "npc_slug");
CREATE INDEX "idx_npc_relation_npc_slug" ON "career"."npc_relation"("npc_slug");

ALTER TABLE "career"."user_career_state" ADD CONSTRAINT "user_career_state_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profile"."user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "career"."career_skill_stat" ADD CONSTRAINT "career_skill_stat_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profile"."user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "career"."rank_progression_event" ADD CONSTRAINT "rank_progression_event_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profile"."user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "career"."mission_arc" ADD CONSTRAINT "mission_arc_rank_code_entry_fkey" FOREIGN KEY ("rank_code_entry") REFERENCES "career"."career_rank"("rank_code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "career"."mission_chapter" ADD CONSTRAINT "mission_chapter_arc_id_fkey" FOREIGN KEY ("arc_id") REFERENCES "career"."mission_arc"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "career"."chapter_attempt" ADD CONSTRAINT "chapter_attempt_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profile"."user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "career"."chapter_attempt" ADD CONSTRAINT "chapter_attempt_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "career"."mission_chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "career"."npc_relation" ADD CONSTRAINT "npc_relation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profile"."user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
