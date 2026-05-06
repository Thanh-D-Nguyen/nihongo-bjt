-- Learner profile cover image (object storage via media.asset).
ALTER TABLE "profile"."user_profile" ADD COLUMN "cover_asset_id" UUID;

ALTER TABLE "profile"."user_profile"
  ADD CONSTRAINT "user_profile_cover_asset_id_fkey"
  FOREIGN KEY ("cover_asset_id") REFERENCES "media"."asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
