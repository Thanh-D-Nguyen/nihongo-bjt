-- AlterTable
ALTER TABLE "example_sentence" ADD COLUMN     "review_reasons" JSONB,
ADD COLUMN     "source_language_confidence" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "grammar_point" ADD COLUMN     "review_reasons" JSONB;

-- AlterTable
ALTER TABLE "kanji" ADD COLUMN     "component_text" TEXT,
ADD COLUMN     "detail" TEXT,
ADD COLUMN     "frequency" INTEGER,
ADD COLUMN     "image_path" TEXT,
ADD COLUMN     "mnemonic" TEXT,
ADD COLUMN     "review_reasons" JSONB,
ADD COLUMN     "short_meaning" TEXT,
ADD COLUMN     "stroke_svg_hash" CHAR(64),
ADD COLUMN     "stroke_svg_path" TEXT,
ADD COLUMN     "stroke_svg_source" TEXT,
ADD COLUMN     "tip" TEXT;

-- AlterTable
ALTER TABLE "lexeme" ADD COLUMN     "review_reasons" JSONB;

-- AlterTable
ALTER TABLE "lexeme_reverse_projection" ADD COLUMN     "review_reasons" JSONB;
