ALTER TABLE "exercise"."exercise"
ADD COLUMN "generation_key" VARCHAR(160);

CREATE UNIQUE INDEX "uq_exercise_generation_key"
ON "exercise"."exercise"("generation_key");

ALTER TABLE "exercise"."exercise_session"
ADD COLUMN "exercise_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];
