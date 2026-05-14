/*
  Warnings:

  - You are about to drop the `consent_record` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey (IF EXISTS for fresh DB)
ALTER TABLE "admin"."audit_log" DROP CONSTRAINT IF EXISTS "fk_admin_audit_log_actor";

ALTER TABLE "assessment"."assessment_remediation_trigger" DROP CONSTRAINT IF EXISTS "fk_assessment_remediation_trigger_rule";

ALTER TABLE "assessment"."bjt_question" DROP CONSTRAINT IF EXISTS "fk_bjt_question_remediation_card";

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'legal' AND table_name = 'consent_record') THEN
    ALTER TABLE "legal"."consent_record" DROP CONSTRAINT IF EXISTS "consent_record_user_id_fkey";
  END IF;
END $$;

-- DropIndex (IF EXISTS)
DROP INDEX IF EXISTS "admin"."idx_admin_audit_log_actor_created_at";
DROP INDEX IF EXISTS "admin"."idx_admin_audit_log_resource_created_at";
DROP INDEX IF EXISTS "assessment"."idx_bjt_question_quality_flags";
DROP INDEX IF EXISTS "learning"."idx_bookmark_user_type_created";

-- AlterTable
ALTER TABLE "assessment"."bjt_question" ADD COLUMN     "audio_script" TEXT,
ADD COLUMN     "audio_url" TEXT,
ADD COLUMN     "image_alt" TEXT,
ADD COLUMN     "image_url" TEXT;

-- AlterTable
ALTER TABLE "daily"."daily_content_item" ADD COLUMN     "image_url" TEXT;

-- AlterTable
ALTER TABLE "daily"."daily_radar_card" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "daily"."daily_radar_module_config" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "learning"."battle_bot" ALTER COLUMN "bot_key" SET DEFAULT 'bot_'::text || replace((gen_random_uuid())::text, '-'::text, ''::text);

-- AlterTable
ALTER TABLE "learning"."battle_round" ADD COLUMN     "opponent_correct" BOOLEAN,
ADD COLUMN     "opponent_option_key" VARCHAR(8),
ADD COLUMN     "opponent_response_ms" INTEGER;

-- AlterTable
ALTER TABLE "learning"."battle_session" ADD COLUMN     "opponent_user_id" UUID;

-- DropTable (IF EXISTS)
DROP TABLE IF EXISTS "legal"."consent_record";

-- CreateTable
CREATE TABLE "legal"."legal_policy" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "policy_key" VARCHAR(64) NOT NULL,
    "version" VARCHAR(32) NOT NULL,
    "effective_at" TIMESTAMPTZ(6) NOT NULL,
    "content_md" TEXT,
    "status" VARCHAR(32) NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monetization"."billing_webhook_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" VARCHAR(32) NOT NULL,
    "event_type" VARCHAR(120) NOT NULL,
    "idempotency_key" VARCHAR(255) NOT NULL,
    "signature_verified" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "raw_payload" JSONB NOT NULL,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),

    CONSTRAINT "billing_webhook_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "href" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "announcement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_legal_policy_key_effective" ON "legal"."legal_policy"("policy_key", "effective_at", "status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_legal_policy_key_version" ON "legal"."legal_policy"("policy_key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "billing_webhook_event_idempotency_key_key" ON "monetization"."billing_webhook_event"("idempotency_key");

-- CreateIndex
CREATE INDEX "idx_billing_webhook_provider_status" ON "monetization"."billing_webhook_event"("provider", "status", "received_at");

-- CreateIndex
CREATE INDEX "idx_billing_webhook_event_type" ON "monetization"."billing_webhook_event"("event_type", "received_at");

-- CreateIndex
CREATE INDEX "idx_admin_audit_log_actor_created_at" ON "admin"."audit_log"("admin_user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_admin_audit_log_resource_created_at" ON "admin"."audit_log"("resource_type", "created_at");

-- CreateIndex
CREATE INDEX "idx_battle_session_opponent_started_at" ON "learning"."battle_session"("opponent_user_id", "started_at");

-- CreateIndex
CREATE INDEX "idx_bookmark_user_type_created" ON "learning"."bookmark"("user_id", "target_type", "created_at");

-- AddForeignKey
ALTER TABLE "assessment"."bjt_question" ADD CONSTRAINT "bjt_question_remediation_card_id_fkey" FOREIGN KEY ("remediation_card_id") REFERENCES "learning"."flashcard_variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment"."assessment_remediation_trigger" ADD CONSTRAINT "assessment_remediation_trigger_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "assessment"."assessment_remediation_rule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin"."audit_log" ADD CONSTRAINT "audit_log_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "authz"."admin_actor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
