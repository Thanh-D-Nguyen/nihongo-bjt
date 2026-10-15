CREATE SCHEMA IF NOT EXISTS "study";

CREATE TABLE "study"."user_review_deck" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "kind" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_review_deck_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_review_deck_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "profile"."user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "idx_user_review_deck_user_created"
  ON "study"."user_review_deck"("user_id", "created_at" DESC);

CREATE TABLE "study"."review_queue" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "exercise_id" UUID NOT NULL,
  "due_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "completed" BOOLEAN NOT NULL DEFAULT FALSE,
  "completed_at" TIMESTAMPTZ(6),
  "correct" BOOLEAN,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "review_queue_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "review_queue_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "profile"."user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "review_queue_exercise_id_fkey"
    FOREIGN KEY ("exercise_id") REFERENCES "exercise"."exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "uq_review_queue_user_exercise" UNIQUE ("user_id", "exercise_id")
);

CREATE INDEX "idx_review_queue_user_completed_due"
  ON "study"."review_queue"("user_id", "completed", "due_at");
