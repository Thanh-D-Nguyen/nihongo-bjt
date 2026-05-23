-- Add appearance preference columns to user_profile
ALTER TABLE "profile"."user_profile"
  ADD COLUMN "theme_mode" VARCHAR(16) NOT NULL DEFAULT 'system',
  ADD COLUMN "font_size_preference" VARCHAR(16) NOT NULL DEFAULT 'default',
  ADD COLUMN "density_preference" VARCHAR(16) NOT NULL DEFAULT 'comfortable';
