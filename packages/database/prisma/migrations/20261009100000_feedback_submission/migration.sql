CREATE TABLE "ops"."feedback_submission" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100),
    "email" VARCHAR(254),
    "category" VARCHAR(16) NOT NULL,
    "message" VARCHAR(5000) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "feedback_submission_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "feedback_submission_category_check" CHECK ("category" IN ('bug', 'feature', 'content', 'other'))
);

CREATE INDEX "idx_feedback_submission_created_at" ON "ops"."feedback_submission"("created_at");
