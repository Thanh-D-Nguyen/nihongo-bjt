-- Battle bot Rive/persona production metadata.
-- Bot identity now comes from PostgreSQL where available, with Rive asset provenance and fallback
-- controls managed by admin. Existing rows receive a generated stable-enough bot_key; seeded/code
-- fallback bots continue to work through the runtime registry when no DB rows exist.

ALTER TABLE "learning"."battle_bot"
  ADD COLUMN "bot_key" VARCHAR(64) NOT NULL DEFAULT ('bot_' || replace(gen_random_uuid()::text, '-', '')),
  ADD COLUMN "avatar_fallback" VARCHAR(12) NOT NULL DEFAULT 'B',
  ADD COLUMN "style_token" VARCHAR(16) NOT NULL DEFAULT 'focused',
  ADD COLUMN "rive_src" TEXT,
  ADD COLUMN "rive_artboard" VARCHAR(80) NOT NULL DEFAULT 'BattleBot',
  ADD COLUMN "rive_state_machine" VARCHAR(80) NOT NULL DEFAULT 'BattleBot',
  ADD COLUMN "rive_license" VARCHAR(120),
  ADD COLUMN "rive_provenance" JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX "battle_bot_bot_key_key" ON "learning"."battle_bot" ("bot_key");
CREATE INDEX "idx_battle_bot_key" ON "learning"."battle_bot" ("bot_key");

ALTER TABLE "learning"."battle_session"
  ALTER COLUMN "bot_key" TYPE VARCHAR(64);

CREATE TABLE "learning"."battle_chat_message" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "room_key" VARCHAR(64) NOT NULL DEFAULT 'global',
    "session_id" UUID,
    "user_id" UUID NOT NULL,
    "display_name" VARCHAR(120),
    "message" VARCHAR(500) NOT NULL,
    "kind" VARCHAR(24) NOT NULL DEFAULT 'chat',
    "moderation_state" VARCHAR(24) NOT NULL DEFAULT 'visible',
    "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "battle_chat_message_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "learning"."battle_chat_message"
  ADD CONSTRAINT "battle_chat_message_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "learning"."battle_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "idx_battle_chat_room_created" ON "learning"."battle_chat_message" ("room_key", "created_at");
CREATE INDEX "idx_battle_chat_user_created" ON "learning"."battle_chat_message" ("user_id", "created_at");
CREATE INDEX "idx_battle_chat_moderation" ON "learning"."battle_chat_message" ("moderation_state", "created_at");
