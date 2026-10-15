CREATE TABLE "curriculum"."bjt_lesson_progress" (
  "user_id" UUID NOT NULL,
  "lesson_id" UUID NOT NULL,
  "completed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bjt_lesson_progress_pkey" PRIMARY KEY ("user_id", "lesson_id"),
  CONSTRAINT "bjt_lesson_progress_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "profile"."user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "bjt_lesson_progress_lesson_id_fkey"
    FOREIGN KEY ("lesson_id") REFERENCES "curriculum"."bjt_lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "idx_bjt_lesson_progress_user_completed"
  ON "curriculum"."bjt_lesson_progress"("user_id", "completed_at" DESC);
