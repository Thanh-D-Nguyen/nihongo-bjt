-- DropForeignKey
ALTER TABLE "assessment"."bjt_question" DROP CONSTRAINT "bjt_question_section_id_fkey";

-- DropForeignKey
ALTER TABLE "assessment"."bjt_question_option" DROP CONSTRAINT "bjt_question_option_question_id_fkey";

-- DropForeignKey
ALTER TABLE "assessment"."bjt_test_section" DROP CONSTRAINT "bjt_test_section_test_id_fkey";

-- DropForeignKey
ALTER TABLE "assessment"."quiz_answer" DROP CONSTRAINT "quiz_answer_question_id_fkey";

-- DropForeignKey
ALTER TABLE "assessment"."quiz_answer" DROP CONSTRAINT "quiz_answer_session_id_fkey";

-- DropForeignKey
ALTER TABLE "assessment"."quiz_session" DROP CONSTRAINT "quiz_session_test_id_fkey";

-- DropForeignKey
ALTER TABLE "authz"."admin_actor_role" DROP CONSTRAINT "admin_actor_role_actor_id_fkey";

-- DropForeignKey
ALTER TABLE "authz"."admin_actor_role" DROP CONSTRAINT "admin_actor_role_role_id_fkey";

-- DropForeignKey
ALTER TABLE "authz"."admin_role_permission" DROP CONSTRAINT "admin_role_permission_permission_id_fkey";

-- DropForeignKey
ALTER TABLE "authz"."admin_role_permission" DROP CONSTRAINT "admin_role_permission_role_id_fkey";

-- DropForeignKey
ALTER TABLE "daily"."daily_content_item" DROP CONSTRAINT "daily_content_item_widget_config_id_fkey";

-- DropForeignKey
ALTER TABLE "daily"."daily_learning_extraction" DROP CONSTRAINT "daily_learning_extraction_daily_content_item_id_fkey";

-- DropForeignKey
ALTER TABLE "daily"."daily_user_action" DROP CONSTRAINT "daily_user_action_daily_content_item_id_fkey";

-- DropForeignKey
ALTER TABLE "learning"."card_media_link" DROP CONSTRAINT "card_media_link_asset_id_fkey";

-- DropForeignKey
ALTER TABLE "learning"."card_media_link" DROP CONSTRAINT "card_media_link_card_id_fkey";

-- DropForeignKey
ALTER TABLE "learning"."deck_card" DROP CONSTRAINT "deck_card_card_id_fkey";

-- DropForeignKey
ALTER TABLE "learning"."deck_card" DROP CONSTRAINT "deck_card_deck_id_fkey";

-- DropForeignKey
ALTER TABLE "learning"."review_event" DROP CONSTRAINT "review_event_user_flashcard_id_fkey";

-- DropForeignKey
ALTER TABLE "learning"."user_flashcard" DROP CONSTRAINT "user_flashcard_card_id_fkey";

-- DropForeignKey
ALTER TABLE "ops"."admin_audit_log" DROP CONSTRAINT "admin_audit_log_actor_id_fkey";

-- DropForeignKey
ALTER TABLE "profile"."user_profile" DROP CONSTRAINT "user_profile_avatar_asset_id_fkey";

-- AlterTable
ALTER TABLE "assessment"."bjt_mock_test" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "assessment"."bjt_question" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "authz"."admin_actor" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "daily"."daily_content_item" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "daily"."daily_widget_config" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "learning"."deck" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "learning"."flashcard_variant" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "learning"."user_flashcard" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "media"."asset" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "profile"."user_profile" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "learning"."battle_session" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "room_code" VARCHAR(16) NOT NULL,
    "mode" VARCHAR(32) NOT NULL DEFAULT 'bot',
    "bot_key" VARCHAR(32),
    "status" VARCHAR(32) NOT NULL DEFAULT 'in_progress',
    "user_score" INTEGER NOT NULL DEFAULT 0,
    "opponent_score" INTEGER NOT NULL DEFAULT 0,
    "max_rounds" INTEGER NOT NULL,
    "current_round_index" INTEGER NOT NULL DEFAULT 0,
    "fairness_seed" VARCHAR(64) NOT NULL,
    "abandoned_reason" VARCHAR(64),
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "battle_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."battle_round" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "round_index" INTEGER NOT NULL,
    "question_id" UUID NOT NULL,
    "user_option_key" VARCHAR(8),
    "user_correct" BOOLEAN,
    "user_response_ms" INTEGER,
    "bot_option_key" VARCHAR(8),
    "bot_correct" BOOLEAN,
    "bot_response_ms" INTEGER,
    "decided_at" TIMESTAMPTZ(6),

    CONSTRAINT "battle_round_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "battle_session_room_code_key" ON "learning"."battle_session"("room_code");

-- CreateIndex
CREATE INDEX "idx_battle_session_user_started_at" ON "learning"."battle_session"("user_id", "started_at");

-- CreateIndex
CREATE INDEX "idx_battle_session_room_status" ON "learning"."battle_session"("room_code", "status");

-- CreateIndex
CREATE INDEX "idx_battle_round_session_id" ON "learning"."battle_round"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_battle_round_session_index" ON "learning"."battle_round"("session_id", "round_index");

-- AddForeignKey
ALTER TABLE "learning"."deck_card" ADD CONSTRAINT "deck_card_deck_id_fkey" FOREIGN KEY ("deck_id") REFERENCES "learning"."deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."deck_card" ADD CONSTRAINT "deck_card_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "learning"."flashcard_variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."user_flashcard" ADD CONSTRAINT "user_flashcard_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "learning"."flashcard_variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."review_event" ADD CONSTRAINT "review_event_user_flashcard_id_fkey" FOREIGN KEY ("user_flashcard_id") REFERENCES "learning"."user_flashcard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."card_media_link" ADD CONSTRAINT "card_media_link_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "learning"."flashcard_variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."card_media_link" ADD CONSTRAINT "card_media_link_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "media"."asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."battle_round" ADD CONSTRAINT "battle_round_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "learning"."battle_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."battle_round" ADD CONSTRAINT "battle_round_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "assessment"."bjt_question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."bjt_test_section" ADD CONSTRAINT "bjt_test_section_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "assessment"."bjt_mock_test"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."bjt_question" ADD CONSTRAINT "bjt_question_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "assessment"."bjt_test_section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."bjt_question_option" ADD CONSTRAINT "bjt_question_option_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "assessment"."bjt_question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."quiz_session" ADD CONSTRAINT "quiz_session_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "assessment"."bjt_mock_test"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."quiz_answer" ADD CONSTRAINT "quiz_answer_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "assessment"."quiz_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."quiz_answer" ADD CONSTRAINT "quiz_answer_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "assessment"."bjt_question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authz"."admin_actor_role" ADD CONSTRAINT "admin_actor_role_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "authz"."admin_actor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authz"."admin_actor_role" ADD CONSTRAINT "admin_actor_role_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "authz"."admin_role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authz"."admin_role_permission" ADD CONSTRAINT "admin_role_permission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "authz"."admin_role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authz"."admin_role_permission" ADD CONSTRAINT "admin_role_permission_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "authz"."admin_permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops"."admin_audit_log" ADD CONSTRAINT "admin_audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "authz"."admin_actor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile"."user_profile" ADD CONSTRAINT "user_profile_avatar_asset_id_fkey" FOREIGN KEY ("avatar_asset_id") REFERENCES "media"."asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily"."daily_content_item" ADD CONSTRAINT "daily_content_item_widget_config_id_fkey" FOREIGN KEY ("widget_config_id") REFERENCES "daily"."daily_widget_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily"."daily_learning_extraction" ADD CONSTRAINT "daily_learning_extraction_daily_content_item_id_fkey" FOREIGN KEY ("daily_content_item_id") REFERENCES "daily"."daily_content_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily"."daily_user_action" ADD CONSTRAINT "daily_user_action_daily_content_item_id_fkey" FOREIGN KEY ("daily_content_item_id") REFERENCES "daily"."daily_content_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
