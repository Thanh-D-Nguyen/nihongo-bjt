ALTER TABLE "profile"."user_profile"
  ADD COLUMN "onboarding_current_level" INTEGER,
  ADD COLUMN "onboarding_topics" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
