CREATE TABLE "learning"."revenge_attempt" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "answered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "revenge_attempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_revenge_attempt_user" ON "learning"."revenge_attempt"("user_id", "answered_at");
CREATE INDEX "idx_revenge_attempt_user_question" ON "learning"."revenge_attempt"("user_id", "question_id");
