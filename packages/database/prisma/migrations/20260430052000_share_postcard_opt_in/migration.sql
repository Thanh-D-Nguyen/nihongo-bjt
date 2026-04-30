-- PH07-T03: explicit learner opt-in before creating public share postcards/pages
ALTER TABLE profile.user_profile
ADD COLUMN share_postcard_opt_in BOOLEAN NOT NULL DEFAULT false;
