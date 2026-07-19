ALTER TABLE "daily"."loto_generation_run"
ADD COLUMN "autopilot_key" VARCHAR(64);

CREATE UNIQUE INDEX "uq_loto_generation_run_autopilot_key"
ON "daily"."loto_generation_run"("autopilot_key");
