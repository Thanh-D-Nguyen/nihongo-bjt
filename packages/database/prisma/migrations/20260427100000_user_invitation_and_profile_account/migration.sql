-- User profile: account / auth / learner extras (no passwords)
ALTER TABLE "profile"."user_profile"
  ADD COLUMN "account_type" VARCHAR(32) NOT NULL DEFAULT 'learner',
  ADD COLUMN "auth_sync_status" VARCHAR(32) NOT NULL DEFAULT 'not_linked',
  ADD COLUMN "daily_study_minutes" INTEGER,
  ADD COLUMN "learning_purpose" VARCHAR(200),
  ADD COLUMN "low_pressure_mode" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "idx_user_profile_account_type" ON "profile"."user_profile"("account_type");
CREATE INDEX "idx_user_profile_auth_sync_status" ON "profile"."user_profile"("auth_sync_status");

-- Backfill: existing rows with Keycloak link are "linked"
UPDATE "profile"."user_profile" SET "auth_sync_status" = 'linked' WHERE "keycloak_subject" IS NOT NULL;

CREATE TABLE "profile"."user_invitation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" VARCHAR(255) NOT NULL,
  "display_name" TEXT NOT NULL,
  "account_type" VARCHAR(32) NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "creation_mode" VARCHAR(40),
  "invited_by_id" UUID NOT NULL,
  "user_profile_id" UUID,
  "keycloak_user_id" VARCHAR(80),
  "invited_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(6),
  "accepted_at" TIMESTAMPTZ(6),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "user_invitation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_user_invitation_email" ON "profile"."user_invitation"("email");
CREATE INDEX "idx_user_invitation_user_profile_id" ON "profile"."user_invitation"("user_profile_id");
CREATE INDEX "idx_user_invitation_status_invited" ON "profile"."user_invitation"("status", "invited_at");

ALTER TABLE "profile"."user_invitation"
  ADD CONSTRAINT "user_invitation_user_profile_id_fkey" FOREIGN KEY ("user_profile_id") REFERENCES "profile"."user_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "profile"."user_invitation"
  ADD CONSTRAINT "user_invitation_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "authz"."admin_actor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
