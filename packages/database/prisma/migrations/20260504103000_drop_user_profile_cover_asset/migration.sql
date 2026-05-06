-- Revert optional learner cover image FK (profile may have been created by an earlier migration).
ALTER TABLE "profile"."user_profile" DROP CONSTRAINT IF EXISTS "user_profile_cover_asset_id_fkey";
ALTER TABLE "profile"."user_profile" DROP COLUMN IF EXISTS "cover_asset_id";
