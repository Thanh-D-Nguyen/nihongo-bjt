-- Add deck sharing fields
ALTER TABLE "learning"."deck" ADD COLUMN "share_token" VARCHAR(64);
ALTER TABLE "learning"."deck" ADD COLUMN "source_deck_id" UUID;
ALTER TABLE "learning"."deck" ADD COLUMN "clone_count" INTEGER NOT NULL DEFAULT 0;

-- Unique index for share token lookups
CREATE UNIQUE INDEX "deck_share_token_key" ON "learning"."deck"("share_token");

-- Index for discovering public shared decks
CREATE INDEX "idx_deck_share_token" ON "learning"."deck"("share_token") WHERE "share_token" IS NOT NULL;
