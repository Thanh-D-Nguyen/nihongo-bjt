-- Daily study goal preference
CREATE TABLE "gamification"."daily_study_goal" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "target_minutes" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "daily_study_goal_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_daily_study_goal_user" ON "gamification"."daily_study_goal"("user_id");

-- Daily study plan
CREATE TABLE "gamification"."daily_study_plan" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "plan_date" DATE NOT NULL,
    "target_minutes" SMALLINT NOT NULL,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "daily_study_plan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_daily_study_plan_user_date" ON "gamification"."daily_study_plan"("user_id", "plan_date");
CREATE INDEX "idx_daily_study_plan_user_date" ON "gamification"."daily_study_plan"("user_id", "plan_date");

-- Daily study tasks
CREATE TABLE "gamification"."daily_study_task" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "plan_id" UUID NOT NULL,
    "task_type" VARCHAR(32) NOT NULL,
    "target_count" SMALLINT NOT NULL,
    "done_count" SMALLINT NOT NULL DEFAULT 0,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "daily_study_task_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "daily_study_task_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "gamification"."daily_study_plan"("id") ON DELETE CASCADE
);
CREATE INDEX "idx_daily_study_task_plan" ON "gamification"."daily_study_task"("plan_id");
