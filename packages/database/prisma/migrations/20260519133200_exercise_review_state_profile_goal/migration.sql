-- Align database with the generated Prisma schema used by exercise review flows.

ALTER TABLE "profile"."user_profile"
  ADD COLUMN IF NOT EXISTS "daily_goal_exercises" INTEGER NOT NULL DEFAULT 10;

CREATE TABLE IF NOT EXISTS "exercise"."exercise_remediation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "exercise_id" UUID NOT NULL,
  "card_id" UUID NOT NULL,
  "source_type" VARCHAR(32) NOT NULL,
  "source_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "exercise_remediation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "exercise"."user_exercise_performance" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "exercise_type" VARCHAR(32) NOT NULL,
  "level" VARCHAR(8) NOT NULL DEFAULT 'all',
  "total_attempts" INTEGER NOT NULL DEFAULT 0,
  "total_correct" INTEGER NOT NULL DEFAULT 0,
  "recent_accuracy" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "current_difficulty" VARCHAR(16) NOT NULL DEFAULT 'medium',
  "avg_time_ms" INTEGER NOT NULL DEFAULT 0,
  "recent_window" JSONB NOT NULL DEFAULT '[]',
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "user_exercise_performance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "exercise"."exercise_review_state" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "exercise_id" UUID NOT NULL,
  "state" VARCHAR(16) NOT NULL DEFAULT 'new',
  "ease_factor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
  "interval_days" INTEGER NOT NULL DEFAULT 0,
  "repetitions" INTEGER NOT NULL DEFAULT 0,
  "lapses" INTEGER NOT NULL DEFAULT 0,
  "due_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "exercise_review_state_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_exercise_remediation_user_exercise"
  ON "exercise"."exercise_remediation"("user_id", "exercise_id");

CREATE INDEX IF NOT EXISTS "idx_exercise_remediation_user"
  ON "exercise"."exercise_remediation"("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "idx_exercise_remediation_card"
  ON "exercise"."exercise_remediation"("card_id");

CREATE UNIQUE INDEX IF NOT EXISTS "uq_user_exercise_perf"
  ON "exercise"."user_exercise_performance"("user_id", "exercise_type", "level");

CREATE INDEX IF NOT EXISTS "idx_user_exercise_perf_type"
  ON "exercise"."user_exercise_performance"("user_id", "exercise_type");

CREATE UNIQUE INDEX IF NOT EXISTS "uq_exercise_review_state"
  ON "exercise"."exercise_review_state"("user_id", "exercise_id");

CREATE INDEX IF NOT EXISTS "idx_exercise_review_due"
  ON "exercise"."exercise_review_state"("user_id", "due_at");

CREATE INDEX IF NOT EXISTS "idx_exercise_review_state"
  ON "exercise"."exercise_review_state"("user_id", "state");
