-- AddColumn: comeback_mode to UserFlashcard for persisted leech recovery flow
ALTER TABLE "learning"."user_flashcard"
ADD COLUMN "comeback_mode" BOOLEAN NOT NULL DEFAULT false;

-- Index for quickly locating learners in comeback recovery mode
CREATE INDEX "idx_user_flashcard_comeback_mode"
ON "learning"."user_flashcard"("user_id", "comeback_mode")
WHERE "comeback_mode" = true;
