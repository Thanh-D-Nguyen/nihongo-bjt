-- Assessment workflow extensions: tags on questions, level on mock tests, remediation rules
-- and triggers tables. Surgical schema additions to support the assessment admin slice without
-- breaking existing learner/quiz data flow.
--
-- Lifecycle / semantics:
--   bjt_question.tags         : free-form taxonomy tags ([] default), used by question bank filters.
--   bjt_mock_test.level       : optional BJT level filter (J1..J5 / N1..N5) for list filters.
--   assessment_remediation_rule  : recommend a content card to learners who fail >= threshold
--     questions matching topic_skill_tag at level within window. active flag controls evaluation.
--   assessment_remediation_trigger : append-only log of fired triggers (read-only timeline). Stores
--     failed question ids snapshot, recommended content id, and FK to rule + session + user. Old
--     rows are kept indefinitely; trimming is deferred.

ALTER TABLE "assessment"."bjt_question"
  ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS "idx_bjt_question_tags" ON "assessment"."bjt_question" USING GIN ("tags");

ALTER TABLE "assessment"."bjt_mock_test"
  ADD COLUMN IF NOT EXISTS "level" VARCHAR(16);

CREATE INDEX IF NOT EXISTS "idx_bjt_mock_test_level" ON "assessment"."bjt_mock_test" ("level");

CREATE TABLE IF NOT EXISTS "assessment"."assessment_remediation_rule" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "topic_skill_tag" VARCHAR(64) NOT NULL,
    "level" VARCHAR(16) NOT NULL,
    "threshold_failed_count" INT NOT NULL,
    "threshold_window_questions" INT NOT NULL,
    "recommended_content_type" VARCHAR(32) NOT NULL,
    "recommended_content_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "assessment_remediation_rule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_assessment_remediation_rule_topic_level" ON "assessment"."assessment_remediation_rule" ("topic_skill_tag", "level");
CREATE INDEX IF NOT EXISTS "idx_assessment_remediation_rule_active" ON "assessment"."assessment_remediation_rule" ("active", "updated_at");

CREATE TABLE IF NOT EXISTS "assessment"."assessment_remediation_trigger" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rule_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_id" UUID,
    "failed_question_ids" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "recommended_content_type" VARCHAR(32) NOT NULL,
    "recommended_content_id" UUID NOT NULL,
    "context" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assessment_remediation_trigger_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fk_assessment_remediation_trigger_rule"
      FOREIGN KEY ("rule_id") REFERENCES "assessment"."assessment_remediation_rule" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_assessment_remediation_trigger_rule_created" ON "assessment"."assessment_remediation_trigger" ("rule_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_assessment_remediation_trigger_user_created" ON "assessment"."assessment_remediation_trigger" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_assessment_remediation_trigger_created" ON "assessment"."assessment_remediation_trigger" ("created_at");
