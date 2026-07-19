-- Additive production curriculum metadata for BJT lessons.
-- Existing lessons remain readable: defaults map them to week 1 lesson units.
-- Rollback is a forward-fix: stop writing the new columns first, then drop only
-- after confirming no production content version relies on lesson_content.

ALTER TABLE "curriculum"."bjt_lesson"
  ADD COLUMN "seed_key" VARCHAR(120),
  ADD COLUMN "week_number" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "unit_type" VARCHAR(24) NOT NULL DEFAULT 'lesson',
  ADD COLUMN "unit_order" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "estimated_duration_min" INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN "difficulty" VARCHAR(32) NOT NULL DEFAULT 'foundation',
  ADD COLUMN "skill_tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "business_topics" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "prerequisite_keys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "lesson_content" JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN "content_version" VARCHAR(32) NOT NULL DEFAULT 'legacy',
  ADD COLUMN "content_hash" CHAR(64),
  ADD COLUMN "published_at" TIMESTAMPTZ(6);

CREATE UNIQUE INDEX "bjt_lesson_seed_key_key"
  ON "curriculum"."bjt_lesson"("seed_key")
  WHERE "seed_key" IS NOT NULL;

CREATE INDEX "idx_bjt_lesson_curriculum_order"
  ON "curriculum"."bjt_lesson"("level_code", "week_number", "unit_order");

CREATE INDEX "idx_bjt_lesson_type_status"
  ON "curriculum"."bjt_lesson"("unit_type", "status");

ALTER TABLE "curriculum"."bjt_lesson"
  ADD CONSTRAINT "chk_bjt_lesson_week_number" CHECK ("week_number" BETWEEN 1 AND 52),
  ADD CONSTRAINT "chk_bjt_lesson_unit_order" CHECK ("unit_order" BETWEEN 1 AND 20),
  ADD CONSTRAINT "chk_bjt_lesson_duration" CHECK ("estimated_duration_min" BETWEEN 5 AND 180),
  ADD CONSTRAINT "chk_bjt_lesson_unit_type" CHECK ("unit_type" IN ('lesson', 'review', 'checkpoint'));
