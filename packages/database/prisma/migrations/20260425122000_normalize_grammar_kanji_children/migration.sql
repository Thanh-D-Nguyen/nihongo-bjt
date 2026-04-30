-- Normalize remaining structured canonical JSON.
-- Backup note: this is local Phase 00 imported canonical data. Staging raw data and provenance remain
-- the source for re-import, so dropping these JSON columns is intentional and followed by clean re-import.

ALTER TABLE "grammar_point" DROP COLUMN "details";
ALTER TABLE "kanji" DROP COLUMN "components", DROP COLUMN "examples";

CREATE TABLE "grammar_point_detail" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "grammar_point_id" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "meaning_vi" TEXT,
  "explanation" TEXT,
  "note" TEXT,
  "synopsis" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "grammar_point_detail_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "grammar_point_detail_example" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "detail_id" UUID NOT NULL,
  "example_sentence_id" UUID,
  "source_example_key" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "grammar_point_detail_example_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "kanji_example" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "kanji_id" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "han_viet" TEXT,
  "meaning_vi" TEXT,
  "reading" TEXT,
  "word" TEXT NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "kanji_example_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "kanji_component" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "kanji_id" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "han_viet" TEXT,
  "character" VARCHAR(8) NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "kanji_component_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_grammar_point_detail_position" ON "grammar_point_detail"("grammar_point_id", "position");
CREATE INDEX "idx_grammar_point_detail_example_sentence" ON "grammar_point_detail_example"("example_sentence_id");
CREATE UNIQUE INDEX "uq_grammar_point_detail_example_source" ON "grammar_point_detail_example"("detail_id", "source_example_key");
CREATE INDEX "idx_kanji_example_word" ON "kanji_example"("word");
CREATE UNIQUE INDEX "uq_kanji_example_position" ON "kanji_example"("kanji_id", "position");
CREATE INDEX "idx_kanji_component_character" ON "kanji_component"("character");
CREATE UNIQUE INDEX "uq_kanji_component_position" ON "kanji_component"("kanji_id", "position");

ALTER TABLE "grammar_point_detail"
  ADD CONSTRAINT "grammar_point_detail_grammar_point_id_fkey"
  FOREIGN KEY ("grammar_point_id") REFERENCES "grammar_point"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "grammar_point_detail_example"
  ADD CONSTRAINT "grammar_point_detail_example_detail_id_fkey"
  FOREIGN KEY ("detail_id") REFERENCES "grammar_point_detail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "grammar_point_detail_example"
  ADD CONSTRAINT "grammar_point_detail_example_example_sentence_id_fkey"
  FOREIGN KEY ("example_sentence_id") REFERENCES "example_sentence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "kanji_example"
  ADD CONSTRAINT "kanji_example_kanji_id_fkey"
  FOREIGN KEY ("kanji_id") REFERENCES "kanji"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "kanji_component"
  ADD CONSTRAINT "kanji_component_kanji_id_fkey"
  FOREIGN KEY ("kanji_id") REFERENCES "kanji"("id") ON DELETE CASCADE ON UPDATE CASCADE;
