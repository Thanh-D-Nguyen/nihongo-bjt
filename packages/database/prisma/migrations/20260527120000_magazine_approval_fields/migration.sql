-- Add approval workflow fields to magazine_article
ALTER TABLE "daily"."magazine_article"
ADD COLUMN "approval_status" VARCHAR(32) NOT NULL DEFAULT 'auto_approved',
ADD COLUMN "approved_by" UUID,
ADD COLUMN "approved_at" TIMESTAMPTZ(6);

-- Index for admin filtering by approval status
CREATE INDEX "idx_magazine_article_approval" ON "daily"."magazine_article"("approval_status", "widget_kind");
