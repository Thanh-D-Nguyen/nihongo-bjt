-- AlterTable
ALTER TABLE "announcement" ADD COLUMN     "allow_click_outside" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allow_close_button" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "bg_preset" VARCHAR(32) NOT NULL DEFAULT 'default',
ADD COLUMN     "dismiss_delay" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "effect" VARCHAR(32) NOT NULL DEFAULT 'none',
ADD COLUMN     "show_frequency" VARCHAR(32) NOT NULL DEFAULT 'once_ever';

-- AlterTable
ALTER TABLE "learning"."battle_bot" ALTER COLUMN "bot_key" SET DEFAULT 'bot_'::text || replace((gen_random_uuid())::text, '-'::text, ''::text);
