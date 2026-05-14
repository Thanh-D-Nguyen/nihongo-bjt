-- AlterTable
ALTER TABLE "announcement" ADD COLUMN     "image_url" TEXT;

-- AlterTable
ALTER TABLE "learning"."battle_bot" ALTER COLUMN "bot_key" SET DEFAULT 'bot_'::text || replace((gen_random_uuid())::text, '-'::text, ''::text);
