-- CreateTable
CREATE TABLE "assessment"."placement_test_session" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "fairness_seed" VARCHAR(64) NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'in_progress',
    "question_ids" JSONB NOT NULL,
    "correct_count" INTEGER,
    "estimated_bjt_band" VARCHAR(16),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "placement_test_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile"."learner_onboarding" (
    "user_id" UUID NOT NULL,
    "current_step" VARCHAR(32) NOT NULL DEFAULT 'not_started',
    "placement_test_session_id" UUID,
    "onboarded_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "learner_onboarding_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "profile"."notification_preference" (
    "user_id" UUID NOT NULL,
    "study_reminders_enabled" BOOLEAN NOT NULL DEFAULT true,
    "product_news_enabled" BOOLEAN NOT NULL DEFAULT false,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_preference_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "profile"."in_app_notification" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "kind" VARCHAR(64) NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "in_app_notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile"."privacy_request" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "kind" VARCHAR(32) NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "result_payload" JSONB,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "privacy_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_placement_test_user_created" ON "assessment"."placement_test_session"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "learner_onboarding_placement_test_session_id_key" ON "profile"."learner_onboarding"("placement_test_session_id");

-- CreateIndex
CREATE INDEX "idx_in_app_notif_user_created" ON "profile"."in_app_notification"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_privacy_request_user_created" ON "profile"."privacy_request"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "profile"."learner_onboarding" ADD CONSTRAINT "learner_onboarding_placement_test_session_id_fkey" FOREIGN KEY ("placement_test_session_id") REFERENCES "assessment"."placement_test_session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
