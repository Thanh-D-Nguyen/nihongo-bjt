-- CreateTable
CREATE TABLE "lexeme" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_type" VARCHAR(64) NOT NULL,
    "source_key" TEXT NOT NULL,
    "import_batch_id" UUID NOT NULL,
    "raw_hash" CHAR(64) NOT NULL,
    "headword" TEXT NOT NULL,
    "reading" TEXT,
    "kanji_meaning_vi" TEXT,
    "senses" JSONB NOT NULL,
    "jlpt_level" VARCHAR(16),
    "short_meaning_vi" TEXT,
    "status" VARCHAR(32) NOT NULL DEFAULT 'active',
    "provenance" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lexeme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lexeme_reverse_projection" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_type" VARCHAR(64) NOT NULL,
    "source_key" TEXT NOT NULL,
    "import_batch_id" UUID NOT NULL,
    "raw_hash" CHAR(64) NOT NULL,
    "vietnamese_headword" TEXT NOT NULL,
    "japanese_candidates" JSONB NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'active',
    "provenance" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lexeme_reverse_projection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kanji" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_type" VARCHAR(64) NOT NULL,
    "source_key" TEXT NOT NULL,
    "import_batch_id" UUID NOT NULL,
    "raw_hash" CHAR(64) NOT NULL,
    "character" VARCHAR(8) NOT NULL,
    "meaning_vi" TEXT,
    "onyomi" TEXT,
    "kunyomi" TEXT,
    "stroke_count" INTEGER,
    "level" INTEGER,
    "examples" JSONB,
    "components" JSONB,
    "status" VARCHAR(32) NOT NULL DEFAULT 'active',
    "provenance" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "kanji_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grammar_point" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_type" VARCHAR(64) NOT NULL,
    "source_key" TEXT NOT NULL,
    "import_batch_id" UUID NOT NULL,
    "raw_hash" CHAR(64) NOT NULL,
    "pattern" TEXT NOT NULL,
    "meaning_vi" TEXT NOT NULL,
    "jlpt_level" VARCHAR(16),
    "details" JSONB NOT NULL,
    "category" TEXT,
    "status" VARCHAR(32) NOT NULL DEFAULT 'active',
    "provenance" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "grammar_point_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "example_sentence" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_type" VARCHAR(64) NOT NULL,
    "source_key" TEXT NOT NULL,
    "import_batch_id" UUID NOT NULL,
    "raw_hash" CHAR(64) NOT NULL,
    "japanese_text" TEXT NOT NULL,
    "reading" TEXT,
    "translation_vi" TEXT,
    "status" VARCHAR(32) NOT NULL DEFAULT 'active',
    "provenance" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "example_sentence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_lexeme_headword" ON "lexeme"("headword");

-- CreateIndex
CREATE INDEX "idx_lexeme_status" ON "lexeme"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_lexeme_source" ON "lexeme"("source_type", "source_key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_lexeme_raw_hash" ON "lexeme"("raw_hash");

-- CreateIndex
CREATE INDEX "idx_lexeme_reverse_projection_headword" ON "lexeme_reverse_projection"("vietnamese_headword");

-- CreateIndex
CREATE INDEX "idx_lexeme_reverse_projection_status" ON "lexeme_reverse_projection"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_lexeme_reverse_projection_source" ON "lexeme_reverse_projection"("source_type", "source_key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_lexeme_reverse_projection_raw_hash" ON "lexeme_reverse_projection"("raw_hash");

-- CreateIndex
CREATE INDEX "idx_kanji_character" ON "kanji"("character");

-- CreateIndex
CREATE INDEX "idx_kanji_status" ON "kanji"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_kanji_source" ON "kanji"("source_type", "source_key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_kanji_raw_hash" ON "kanji"("raw_hash");

-- CreateIndex
CREATE INDEX "idx_grammar_point_pattern" ON "grammar_point"("pattern");

-- CreateIndex
CREATE INDEX "idx_grammar_point_jlpt_level" ON "grammar_point"("jlpt_level");

-- CreateIndex
CREATE INDEX "idx_grammar_point_status" ON "grammar_point"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_grammar_point_source" ON "grammar_point"("source_type", "source_key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_grammar_point_raw_hash" ON "grammar_point"("raw_hash");

-- CreateIndex
CREATE INDEX "idx_example_sentence_japanese_text" ON "example_sentence"("japanese_text");

-- CreateIndex
CREATE INDEX "idx_example_sentence_status" ON "example_sentence"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_example_sentence_source" ON "example_sentence"("source_type", "source_key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_example_sentence_raw_hash" ON "example_sentence"("raw_hash");
