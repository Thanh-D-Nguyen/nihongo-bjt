-- Battle remaining slice — admin CRUD for bot personas + moderation queue for abuse reports.
--
-- `BattleAdminController` previously rendered code-defined `BATTLE_BOT_PROFILES` and computed abuse
-- signals from `battle_session` aggregates. That worked for read-only viewers but blocked admin
-- workflows: ops cannot tune bot difficulty without redeploys, and there is no place to triage user
-- abuse reports. We add two managed entities so the admin Battle surface (battle/bots, battle/abuse)
-- has real CRUD/moderation workflows with audit. `BattleSeason` is intentionally NOT created in this
-- slice (leaderboard remains window-based); season management is tracked as `partial_schema_pending`.

CREATE TABLE "learning"."battle_bot" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(80) NOT NULL,
    "difficulty" VARCHAR(16) NOT NULL,
    "persona" TEXT,
    "accuracy_pct" INTEGER NOT NULL,
    "min_delay_ms" INTEGER NOT NULL,
    "max_delay_ms" INTEGER NOT NULL,
    "vocabulary_level" VARCHAR(32) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'active',
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "battle_bot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_battle_bot_status" ON "learning"."battle_bot" ("status");
CREATE INDEX "idx_battle_bot_difficulty" ON "learning"."battle_bot" ("difficulty");
CREATE INDEX "idx_battle_bot_updated_at" ON "learning"."battle_bot" ("updated_at");

CREATE TABLE "learning"."battle_abuse_report" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reporter_id" UUID,
    "subject_id" UUID NOT NULL,
    "match_id" UUID,
    "severity" VARCHAR(16) NOT NULL DEFAULT 'medium',
    "kind" VARCHAR(32) NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "status" VARCHAR(16) NOT NULL DEFAULT 'open',
    "action_taken" VARCHAR(32),
    "resolution_notes" TEXT,
    "resolved_by_id" UUID,
    "resolved_at" TIMESTAMPTZ(6),
    "escalated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "battle_abuse_report_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_battle_abuse_status" ON "learning"."battle_abuse_report" ("status", "created_at");
CREATE INDEX "idx_battle_abuse_subject" ON "learning"."battle_abuse_report" ("subject_id", "created_at");
CREATE INDEX "idx_battle_abuse_severity" ON "learning"."battle_abuse_report" ("severity", "status");
CREATE INDEX "idx_battle_abuse_reporter" ON "learning"."battle_abuse_report" ("reporter_id");
