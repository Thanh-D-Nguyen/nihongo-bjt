/*
  Warnings:

  - You are about to drop the `consent_record` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "auth"."auth_link_code" DROP CONSTRAINT "auth_link_code_user_id_fkey";

-- DropForeignKey
ALTER TABLE "auth"."identity_provider_account" DROP CONSTRAINT "identity_provider_account_user_id_fkey";

-- DropForeignKey
ALTER TABLE "growth"."referral_code" DROP CONSTRAINT "referral_code_user_id_fkey";

-- DropForeignKey
ALTER TABLE "growth"."referral_event" DROP CONSTRAINT "referral_event_referred_user_id_fkey";

-- DropForeignKey
ALTER TABLE "growth"."referral_event" DROP CONSTRAINT "referral_event_referrer_user_id_fkey";

-- DropForeignKey
ALTER TABLE "growth"."referral_quota_credit" DROP CONSTRAINT "referral_quota_credit_user_id_fkey";

-- DropForeignKey
ALTER TABLE "growth"."share_card_asset" DROP CONSTRAINT "share_card_asset_share_item_id_fkey";

-- DropForeignKey
ALTER TABLE "growth"."share_item" DROP CONSTRAINT "share_item_template_id_fkey";

-- DropForeignKey
ALTER TABLE "growth"."share_item" DROP CONSTRAINT "share_item_user_id_fkey";

-- DropForeignKey
ALTER TABLE "l10n"."translation_value" DROP CONSTRAINT "translation_value_key_id_fkey";

-- DropForeignKey
ALTER TABLE "l10n"."translation_value" DROP CONSTRAINT "translation_value_locale_code_fkey";

-- DropForeignKey
ALTER TABLE "legal"."consent_record" DROP CONSTRAINT "consent_record_user_id_fkey";

-- DropForeignKey
ALTER TABLE "monetization"."ad_impression" DROP CONSTRAINT "ad_impression_placement_id_fkey";

-- DropForeignKey
ALTER TABLE "monetization"."ad_impression" DROP CONSTRAINT "fk_ad_impression_campaign";

-- DropForeignKey
ALTER TABLE "monetization"."plan_entitlement" DROP CONSTRAINT "plan_entitlement_entitlement_id_fkey";

-- DropForeignKey
ALTER TABLE "monetization"."plan_entitlement" DROP CONSTRAINT "plan_entitlement_plan_id_fkey";

-- DropForeignKey
ALTER TABLE "monetization"."plan_quota" DROP CONSTRAINT "plan_quota_plan_id_fkey";

-- DropForeignKey
ALTER TABLE "monetization"."plan_quota" DROP CONSTRAINT "plan_quota_quota_policy_id_fkey";

-- DropForeignKey
ALTER TABLE "monetization"."quota_user_override" DROP CONSTRAINT "quota_user_override_user_id_fkey";

-- DropForeignKey
ALTER TABLE "monetization"."subscription_event" DROP CONSTRAINT "subscription_event_subscription_id_fkey";

-- DropForeignKey
ALTER TABLE "monetization"."usage_counter" DROP CONSTRAINT "usage_counter_user_id_fkey";

-- DropForeignKey
ALTER TABLE "monetization"."usage_event" DROP CONSTRAINT "usage_event_usage_counter_id_fkey";

-- DropForeignKey
ALTER TABLE "monetization"."usage_event" DROP CONSTRAINT "usage_event_user_id_fkey";

-- DropForeignKey
ALTER TABLE "monetization"."user_subscription" DROP CONSTRAINT "user_subscription_plan_id_fkey";

-- DropForeignKey
ALTER TABLE "monetization"."user_subscription" DROP CONSTRAINT "user_subscription_user_id_fkey";

-- DropForeignKey
ALTER TABLE "ops"."feature_flag_audit" DROP CONSTRAINT "feature_flag_audit_flag_key_fkey";

-- DropIndex
DROP INDEX "learning"."idx_bookmark_user_type_created";

-- DropIndex
DROP INDEX "learning"."idx_reading_text_analysis_updated";

-- DropIndex
DROP INDEX "ops"."idx_dead_letter_entry_status_created";

-- DropIndex
DROP INDEX "ops"."idx_feature_flag_audit_flag_created";

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

-- DropTable
DROP TABLE "legal"."consent_record";

-- CreateIndex
CREATE INDEX "idx_bookmark_user_type_created" ON "learning"."bookmark"("user_id", "target_type", "created_at");

-- CreateIndex
CREATE INDEX "idx_promotion_coupon_code" ON "monetization"."promotion_coupon"("code");

-- CreateIndex
CREATE INDEX "idx_dead_letter_entry_status_created" ON "ops"."dead_letter_entry"("status", "created_at");

-- CreateIndex
CREATE INDEX "idx_feature_flag_audit_flag_created" ON "ops"."feature_flag_audit"("flag_key", "created_at");

-- RenameForeignKey
ALTER TABLE "learning"."reading_assist_report" RENAME CONSTRAINT "reading_assist_report_user_id_fkey" TO "fk_reading_assist_report_user";

-- RenameForeignKey
ALTER TABLE "profile"."reading_user_preference" RENAME CONSTRAINT "reading_user_preference_user_id_fkey" TO "fk_reading_user_preference_user";

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

-- RenameIndex
ALTER INDEX "auth"."uq_auth_link_code_hash" RENAME TO "auth_link_code_code_hash_key";

-- RenameIndex
ALTER INDEX "growth"."uq_referral_code_user" RENAME TO "referral_code_user_id_key";

-- RenameIndex
ALTER INDEX "growth"."uq_referral_code_value" RENAME TO "referral_code_code_key";

-- RenameIndex
ALTER INDEX "learning"."uq_reading_text_analysis_hash" RENAME TO "reading_text_analysis_text_hash_key";
