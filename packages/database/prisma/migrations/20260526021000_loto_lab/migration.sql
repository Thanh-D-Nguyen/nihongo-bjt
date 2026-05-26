CREATE TABLE "daily"."loto_draw" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "game" VARCHAR(16) NOT NULL,
  "draw_number" INTEGER NOT NULL,
  "draw_date" DATE NOT NULL,
  "main_numbers" INTEGER[] NOT NULL,
  "bonus_numbers" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "carryover_amount" BIGINT,
  "sales_amount" BIGINT,
  "source_url" TEXT,
  "source_provider" VARCHAR(32) NOT NULL DEFAULT 'csv_import',
  "imported_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "loto_draw_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "daily"."loto_generation_run" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "game" VARCHAR(16) NOT NULL,
  "target_draw_date" DATE NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'generated',
  "seed" VARCHAR(128),
  "requested_set_count" INTEGER NOT NULL DEFAULT 3,
  "input_config_json" JSONB NOT NULL DEFAULT '{}',
  "algorithm_weights_json" JSONB NOT NULL DEFAULT '{}',
  "context_json" JSONB NOT NULL DEFAULT '{}',
  "japanese_sentence_json" JSONB,
  "selected_set_id" UUID,
  "created_by_admin_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "loto_generation_run_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "daily"."loto_generated_set" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "run_id" UUID NOT NULL,
  "rank" INTEGER NOT NULL,
  "main_numbers" INTEGER[] NOT NULL,
  "bonus_numbers" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "score" DOUBLE PRECISION NOT NULL,
  "explanation_json" JSONB NOT NULL DEFAULT '{}',
  "selected_for_magazine" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "loto_generated_set_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_loto_draw_game_number" ON "daily"."loto_draw"("game", "draw_number");
CREATE INDEX "idx_loto_draw_game_date" ON "daily"."loto_draw"("game", "draw_date" DESC);
CREATE INDEX "idx_loto_generation_run_game_date" ON "daily"."loto_generation_run"("game", "target_draw_date" DESC);
CREATE INDEX "idx_loto_generation_run_created_at" ON "daily"."loto_generation_run"("created_at" DESC);
CREATE INDEX "idx_loto_generated_set_run_rank" ON "daily"."loto_generated_set"("run_id", "rank");

ALTER TABLE "daily"."loto_generated_set"
  ADD CONSTRAINT "loto_generated_set_run_id_fkey"
  FOREIGN KEY ("run_id") REFERENCES "daily"."loto_generation_run"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
