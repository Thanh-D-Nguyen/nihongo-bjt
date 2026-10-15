CREATE TABLE "career"."context_memo" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "memo_type" VARCHAR(32) NOT NULL,
  "payload" JSONB NOT NULL,
  "feedback" VARCHAR(16),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "read_at" TIMESTAMPTZ(6),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "context_memo_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "context_memo_payload_object" CHECK (jsonb_typeof("payload") = 'object'),
  CONSTRAINT "context_memo_feedback_valid" CHECK ("feedback" IS NULL OR "feedback" IN ('useful', 'fuzzy', 'lost')),
  CONSTRAINT "context_memo_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profile"."user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "idx_context_memo_user_created"
  ON "career"."context_memo"("user_id", "created_at" DESC);
