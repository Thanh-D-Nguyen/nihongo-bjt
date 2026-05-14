-- AlterTable
ALTER TABLE "announcement" ADD COLUMN     "body_en" TEXT,
ADD COLUMN     "body_ja" TEXT,
ADD COLUMN     "body_vi" TEXT,
ADD COLUMN     "created_by" TEXT,
ADD COLUMN     "cta_label" TEXT,
ADD COLUMN     "cta_url" TEXT,
ADD COLUMN     "ends_at" TIMESTAMPTZ(6),
ADD COLUMN     "format" VARCHAR(32) NOT NULL DEFAULT 'banner',
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "starts_at" TIMESTAMPTZ(6),
ADD COLUMN     "target" VARCHAR(32) NOT NULL DEFAULT 'all',
ADD COLUMN     "title_en" TEXT,
ADD COLUMN     "title_ja" TEXT,
ADD COLUMN     "title_vi" TEXT;

-- AlterTable
ALTER TABLE "learning"."battle_bot" ALTER COLUMN "bot_key" SET DEFAULT 'bot_'::text || replace((gen_random_uuid())::text, '-'::text, ''::text);

-- CreateTable
CREATE TABLE "announcement_dismissal" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "announcement_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "dismissed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_dismissal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "announcement_dismissal_announcement_id_user_id_key" ON "announcement_dismissal"("announcement_id", "user_id");

-- AddForeignKey
ALTER TABLE "announcement_dismissal" ADD CONSTRAINT "announcement_dismissal_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
