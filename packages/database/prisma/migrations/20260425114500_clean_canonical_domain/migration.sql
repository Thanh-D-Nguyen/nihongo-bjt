-- Phase 00 clean canonical reshape.
-- Backup note: this migration intentionally drops previously imported local Phase 00 canonical rows/columns
-- after canonical tables were cleared. Staging tables keep the full raw source and import batch history.

DROP INDEX "uq_example_sentence_raw_hash";
DROP INDEX "uq_example_sentence_source";
DROP INDEX "uq_grammar_point_raw_hash";
DROP INDEX "uq_grammar_point_source";
DROP INDEX "uq_kanji_raw_hash";
DROP INDEX "uq_kanji_source";
DROP INDEX "uq_lexeme_raw_hash";
DROP INDEX "uq_lexeme_source";
DROP INDEX "uq_lexeme_reverse_projection_raw_hash";
DROP INDEX "uq_lexeme_reverse_projection_source";

ALTER TABLE "example_sentence"
  DROP COLUMN "import_batch_id",
  DROP COLUMN "provenance",
  DROP COLUMN "raw_hash",
  DROP COLUMN "source_key",
  DROP COLUMN "source_type";

ALTER TABLE "grammar_point"
  DROP COLUMN "import_batch_id",
  DROP COLUMN "provenance",
  DROP COLUMN "raw_hash",
  DROP COLUMN "source_key",
  DROP COLUMN "source_type";

ALTER TABLE "kanji"
  DROP COLUMN "import_batch_id",
  DROP COLUMN "provenance",
  DROP COLUMN "raw_hash",
  DROP COLUMN "source_key",
  DROP COLUMN "source_type";

ALTER TABLE "lexeme"
  DROP COLUMN "import_batch_id",
  DROP COLUMN "provenance",
  DROP COLUMN "raw_hash",
  DROP COLUMN "senses",
  DROP COLUMN "source_key",
  DROP COLUMN "source_type";

ALTER TABLE "lexeme_reverse_projection"
  DROP COLUMN "import_batch_id",
  DROP COLUMN "japanese_candidates",
  DROP COLUMN "provenance",
  DROP COLUMN "raw_hash",
  DROP COLUMN "source_key",
  DROP COLUMN "source_type";

CREATE TABLE "entity_import_provenance" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "entity_type" VARCHAR(80) NOT NULL,
  "entity_id" UUID NOT NULL,
  "source_type" VARCHAR(64) NOT NULL,
  "source_key" TEXT NOT NULL,
  "source_file" TEXT NOT NULL,
  "import_batch_id" UUID NOT NULL,
  "raw_hash" CHAR(64) NOT NULL,
  "raw_item_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "entity_import_provenance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lexeme_sense" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "lexeme_id" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "part_of_speech" TEXT,
  "meaning_vi" TEXT NOT NULL,
  "field" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lexeme_sense_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lexeme_sense_example" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "sense_id" UUID NOT NULL,
  "example_sentence_id" UUID,
  "source_example_key" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lexeme_sense_example_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lexeme_reverse_candidate" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "projection_id" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "part_of_speech" TEXT,
  "japanese_text" TEXT NOT NULL,
  "reading" TEXT,
  "kanji_text" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lexeme_reverse_candidate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lexeme_reverse_candidate_example" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "candidate_id" UUID NOT NULL,
  "example_sentence_id" UUID,
  "source_example_key" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lexeme_reverse_candidate_example_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_entity_import_provenance_batch" ON "entity_import_provenance"("import_batch_id");
CREATE UNIQUE INDEX "uq_entity_import_provenance_entity" ON "entity_import_provenance"("entity_type", "entity_id");
CREATE UNIQUE INDEX "uq_entity_import_provenance_source" ON "entity_import_provenance"("source_type", "source_key");
CREATE INDEX "idx_lexeme_sense_part_of_speech" ON "lexeme_sense"("part_of_speech");
CREATE UNIQUE INDEX "uq_lexeme_sense_position" ON "lexeme_sense"("lexeme_id", "position");
CREATE INDEX "idx_lexeme_sense_example_sentence" ON "lexeme_sense_example"("example_sentence_id");
CREATE UNIQUE INDEX "uq_lexeme_sense_example_source" ON "lexeme_sense_example"("sense_id", "source_example_key");
CREATE INDEX "idx_lexeme_reverse_candidate_japanese_text" ON "lexeme_reverse_candidate"("japanese_text");
CREATE UNIQUE INDEX "uq_lexeme_reverse_candidate_position" ON "lexeme_reverse_candidate"("projection_id", "position");
CREATE INDEX "idx_lexeme_reverse_candidate_example_sentence" ON "lexeme_reverse_candidate_example"("example_sentence_id");
CREATE UNIQUE INDEX "uq_lexeme_reverse_candidate_example_source" ON "lexeme_reverse_candidate_example"("candidate_id", "source_example_key");
CREATE UNIQUE INDEX "uq_grammar_point_pattern" ON "grammar_point"("pattern");
CREATE UNIQUE INDEX "uq_kanji_character" ON "kanji"("character");

ALTER TABLE "lexeme_sense"
  ADD CONSTRAINT "lexeme_sense_lexeme_id_fkey"
  FOREIGN KEY ("lexeme_id") REFERENCES "lexeme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lexeme_sense_example"
  ADD CONSTRAINT "lexeme_sense_example_sense_id_fkey"
  FOREIGN KEY ("sense_id") REFERENCES "lexeme_sense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lexeme_sense_example"
  ADD CONSTRAINT "lexeme_sense_example_example_sentence_id_fkey"
  FOREIGN KEY ("example_sentence_id") REFERENCES "example_sentence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "lexeme_reverse_candidate"
  ADD CONSTRAINT "lexeme_reverse_candidate_projection_id_fkey"
  FOREIGN KEY ("projection_id") REFERENCES "lexeme_reverse_projection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lexeme_reverse_candidate_example"
  ADD CONSTRAINT "lexeme_reverse_candidate_example_candidate_id_fkey"
  FOREIGN KEY ("candidate_id") REFERENCES "lexeme_reverse_candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lexeme_reverse_candidate_example"
  ADD CONSTRAINT "lexeme_reverse_candidate_example_example_sentence_id_fkey"
  FOREIGN KEY ("example_sentence_id") REFERENCES "example_sentence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
