-- AddColumn: leeched to UserFlashcard
-- Leech detection: card marked as leeched when lapses >= 8 (indicates persistent difficulty)
-- Learning science: leeched cards need comeback mode with reduced intervals for recovery

ALTER TABLE "learning"."user_flashcard" ADD COLUMN "leeched" BOOLEAN NOT NULL DEFAULT false;

-- Index for finding leeched cards efficiently
CREATE INDEX "idx_user_flashcard_leeched" ON "learning"."user_flashcard"("user_id", "leeched") WHERE "leeched" = true;

-- Index for leeched cards due for review
CREATE INDEX "idx_user_flashcard_leeched_due" ON "learning"."user_flashcard"("user_id", "due_at") WHERE "leeched" = true;
