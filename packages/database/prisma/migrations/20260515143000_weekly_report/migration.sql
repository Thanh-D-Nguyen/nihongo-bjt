CREATE TABLE "analytics"."weekly_report" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "week_start" DATE NOT NULL,
    "week_end" DATE NOT NULL,
    "total_reviews" INTEGER NOT NULL DEFAULT 0,
    "accuracy_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "streak_days" INTEGER NOT NULL DEFAULT 0,
    "quiz_sessions" INTEGER NOT NULL DEFAULT 0,
    "new_cards_learned" INTEGER NOT NULL DEFAULT 0,
    "weak_skills" TEXT[] NOT NULL DEFAULT '{}',
    "prev_week_reviews" INTEGER,
    "prev_week_accuracy" DOUBLE PRECISION,
    "email_sent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "weekly_report_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_weekly_report_user_week" ON "analytics"."weekly_report"("user_id", "week_start");
CREATE INDEX "idx_weekly_report_user_week" ON "analytics"."weekly_report"("user_id", "week_start");
