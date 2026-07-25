ALTER TABLE "assessment"."bjt_question"
ADD COLUMN "image_prompt" TEXT;

CREATE INDEX CONCURRENTLY "idx_lexeme_reading"
ON "content"."lexeme"("reading");
