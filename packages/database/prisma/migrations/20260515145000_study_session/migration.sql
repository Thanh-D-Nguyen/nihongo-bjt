CREATE TABLE "learning"."study_session" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "mode" VARCHAR(20) NOT NULL DEFAULT 'focus',
    "duration_minutes" INTEGER NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(6),
    "reviews_done" INTEGER NOT NULL DEFAULT 0,
    "quizzes_done" INTEGER NOT NULL DEFAULT 0,
    "xp_earned" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "study_session_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_study_session_user" ON "learning"."study_session"("user_id", "started_at");
