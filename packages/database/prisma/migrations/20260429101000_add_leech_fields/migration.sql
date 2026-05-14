/*
  Warnings:

  - You are about to drop the `consent_record` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey (all IF EXISTS for fresh DB compatibility)
ALTER TABLE "auth"."auth_link_code" DROP CONSTRAINT IF EXISTS "auth_link_code_user_id_fkey";
ALTER TABLE "auth"."identity_provider_account" DROP CONSTRAINT IF EXISTS "identity_provider_account_user_id_fkey";
ALTER TABLE "growth"."referral_code" DROP CONSTRAINT IF EXISTS "referral_code_user_id_fkey";
ALTER TABLE "growth"."referral_event" DROP CONSTRAINT IF EXISTS "referral_event_referred_user_id_fkey";
ALTER TABLE "growth"."referral_event" DROP CONSTRAINT IF EXISTS "referral_event_referrer_user_id_fkey";
ALTER TABLE "growth"."referral_quota_credit" DROP CONSTRAINT IF EXISTS "referral_quota_credit_user_id_fkey";
ALTER TABLE "growth"."share_card_asset" DROP CONSTRAINT IF EXISTS "share_card_asset_share_item_id_fkey";
ALTER TABLE "growth"."share_item" DROP CONSTRAINT IF EXISTS "share_item_template_id_fkey";
ALTER TABLE "growth"."share_item" DROP CONSTRAINT IF EXISTS "share_item_user_id_fkey";
ALTER TABLE "l10n"."translation_value" DROP CONSTRAINT IF EXISTS "translation_value_key_id_fkey";
ALTER TABLE "l10n"."translation_value" DROP CONSTRAINT IF EXISTS "translation_value_locale_code_fkey";

-- DropForeignKey (conditional — table may not exist on fresh DB)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'legal' AND table_name = 'consent_record') THEN
    ALTER TABLE "legal"."consent_record" DROP CONSTRAINT IF EXISTS "consent_record_user_id_fkey";
  END IF;
END $$;

ALTER TABLE "monetization"."ad_impression" DROP CONSTRAINT IF EXISTS "ad_impression_placement_id_fkey";
ALTER TABLE "monetization"."ad_impression" DROP CONSTRAINT IF EXISTS "fk_ad_impression_campaign";
ALTER TABLE "monetization"."plan_entitlement" DROP CONSTRAINT IF EXISTS "plan_entitlement_entitlement_id_fkey";
ALTER TABLE "monetization"."plan_entitlement" DROP CONSTRAINT IF EXISTS "plan_entitlement_plan_id_fkey";
ALTER TABLE "monetization"."plan_quota" DROP CONSTRAINT IF EXISTS "plan_quota_plan_id_fkey";
ALTER TABLE "monetization"."plan_quota" DROP CONSTRAINT IF EXISTS "plan_quota_quota_policy_id_fkey";
ALTER TABLE "monetization"."quota_user_override" DROP CONSTRAINT IF EXISTS "quota_user_override_user_id_fkey";
ALTER TABLE "monetization"."subscription_event" DROP CONSTRAINT IF EXISTS "subscription_event_subscription_id_fkey";
ALTER TABLE "monetization"."usage_counter" DROP CONSTRAINT IF EXISTS "usage_counter_user_id_fkey";
ALTER TABLE "monetization"."usage_event" DROP CONSTRAINT IF EXISTS "usage_event_usage_counter_id_fkey";
ALTER TABLE "monetization"."usage_event" DROP CONSTRAINT IF EXISTS "usage_event_user_id_fkey";
ALTER TABLE "monetization"."user_subscription" DROP CONSTRAINT IF EXISTS "user_subscription_plan_id_fkey";
ALTER TABLE "monetization"."user_subscription" DROP CONSTRAINT IF EXISTS "user_subscription_user_id_fkey";
ALTER TABLE "ops"."feature_flag_audit" DROP CONSTRAINT IF EXISTS "feature_flag_audit_flag_key_fkey";

-- DropIndex (IF EXISTS for fresh DB)
DROP INDEX IF EXISTS "learning"."idx_bookmark_user_type_created";
DROP INDEX IF EXISTS "learning"."idx_reading_text_analysis_updated";
DROP INDEX IF EXISTS "ops"."idx_dead_letter_entry_status_created";
DROP INDEX IF EXISTS "ops"."idx_feature_flag_audit_flag_created";

-- AlterTable
ALTER TABLE "growth"."share_template" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "l10n"."locale" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "l10n"."translation_key" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "l10n"."translation_value" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "learning"."reading_text_analysis" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "monetization"."ad_campaign" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "monetization"."ad_placement" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "monetization"."ad_provider_config" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "monetization"."ad_safety_rule" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "monetization"."plan" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "monetization"."promotion_coupon" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "monetization"."usage_counter" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "monetization"."user_subscription" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ops"."feature_flag" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "profile"."reading_user_preference" ALTER COLUMN "updated_at" DROP DEFAULT;

-- DropTable (conditional — may not exist on fresh DB)
DROP TABLE IF EXISTS "legal"."consent_record";

-- CreateIndex (conditional — bookmark table may be created by a later migration)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'learning' AND table_name = 'bookmark') THEN
    CREATE INDEX IF NOT EXISTS "idx_bookmark_user_type_created" ON "learning"."bookmark"("user_id", "target_type", "created_at");
  END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_promotion_coupon_code" ON "monetization"."promotion_coupon"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_dead_letter_entry_status_created" ON "ops"."dead_letter_entry"("status", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_feature_flag_audit_flag_created" ON "ops"."feature_flag_audit"("flag_key", "created_at");

-- RenameForeignKey (conditional — constraint may not exist on fresh DB)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'reading_assist_report_user_id_fkey' AND table_schema = 'learning') THEN
    ALTER TABLE "learning"."reading_assist_report" RENAME CONSTRAINT "reading_assist_report_user_id_fkey" TO "fk_reading_assist_report_user";
  END IF;
END $$;

-- RenameForeignKey
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'reading_user_preference_user_id_fkey' AND table_schema = 'profile') THEN
    ALTER TABLE "profile"."reading_user_preference" RENAME CONSTRAINT "reading_user_preference_user_id_fkey" TO "fk_reading_user_preference_user";
  END IF;
END $$;

-- AddForeignKey
ALTER TABLE "monetization"."plan_entitlement" ADD CONSTRAINT "plan_entitlement_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "monetization"."plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monetization"."plan_entitlement" ADD CONSTRAINT "plan_entitlement_entitlement_id_fkey" FOREIGN KEY ("entitlement_id") REFERENCES "monetization"."entitlement_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monetization"."plan_quota" ADD CONSTRAINT "plan_quota_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "monetization"."plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monetization"."plan_quota" ADD CONSTRAINT "plan_quota_quota_policy_id_fkey" FOREIGN KEY ("quota_policy_id") REFERENCES "monetization"."quota_policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monetization"."user_subscription" ADD CONSTRAINT "user_subscription_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profile"."user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monetization"."user_subscription" ADD CONSTRAINT "user_subscription_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "monetization"."plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monetization"."quota_user_override" ADD CONSTRAINT "quota_user_override_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profile"."user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monetization"."subscription_event" ADD CONSTRAINT "subscription_event_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "monetization"."user_subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monetization"."usage_counter" ADD CONSTRAINT "usage_counter_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profile"."user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monetization"."usage_event" ADD CONSTRAINT "usage_event_usage_counter_id_fkey" FOREIGN KEY ("usage_counter_id") REFERENCES "monetization"."usage_counter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monetization"."ad_impression" ADD CONSTRAINT "ad_impression_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "monetization"."ad_campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monetization"."ad_impression" ADD CONSTRAINT "ad_impression_placement_id_fkey" FOREIGN KEY ("placement_id") REFERENCES "monetization"."ad_placement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."identity_provider_account" ADD CONSTRAINT "identity_provider_account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profile"."user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."auth_link_code" ADD CONSTRAINT "auth_link_code_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profile"."user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth"."share_item" ADD CONSTRAINT "share_item_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "growth"."share_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth"."share_item" ADD CONSTRAINT "share_item_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profile"."user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth"."share_card_asset" ADD CONSTRAINT "share_card_asset_share_item_id_fkey" FOREIGN KEY ("share_item_id") REFERENCES "growth"."share_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth"."referral_code" ADD CONSTRAINT "referral_code_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profile"."user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth"."referral_event" ADD CONSTRAINT "referral_event_referred_user_id_fkey" FOREIGN KEY ("referred_user_id") REFERENCES "profile"."user_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth"."referral_event" ADD CONSTRAINT "referral_event_referrer_user_id_fkey" FOREIGN KEY ("referrer_user_id") REFERENCES "profile"."user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth"."referral_quota_credit" ADD CONSTRAINT "referral_quota_credit_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profile"."user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "l10n"."translation_value" ADD CONSTRAINT "translation_value_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "l10n"."translation_key"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "l10n"."translation_value" ADD CONSTRAINT "translation_value_locale_code_fkey" FOREIGN KEY ("locale_code") REFERENCES "l10n"."locale"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops"."feature_flag_audit" ADD CONSTRAINT "feature_flag_audit_flag_key_fkey" FOREIGN KEY ("flag_key") REFERENCES "ops"."feature_flag"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex (conditional — may not exist on fresh DB)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'auth' AND indexname = 'uq_auth_link_code_hash') THEN
    ALTER INDEX "auth"."uq_auth_link_code_hash" RENAME TO "auth_link_code_code_hash_key";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'growth' AND indexname = 'uq_referral_code_user') THEN
    ALTER INDEX "growth"."uq_referral_code_user" RENAME TO "referral_code_user_id_key";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'growth' AND indexname = 'uq_referral_code_value') THEN
    ALTER INDEX "growth"."uq_referral_code_value" RENAME TO "referral_code_code_key";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'learning' AND indexname = 'uq_reading_text_analysis_hash') THEN
    ALTER INDEX "learning"."uq_reading_text_analysis_hash" RENAME TO "reading_text_analysis_text_hash_key";
  END IF;
END $$;
