CREATE TABLE "gamification"."companion_pet" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" VARCHAR(30) NOT NULL DEFAULT 'Shiba',
    "stage" VARCHAR(20) NOT NULL DEFAULT 'egg',
    "xp" INTEGER NOT NULL DEFAULT 0,
    "happiness" INTEGER NOT NULL DEFAULT 100,
    "mood" VARCHAR(20) NOT NULL DEFAULT 'happy',
    "total_feedings" INTEGER NOT NULL DEFAULT 0,
    "last_fed_at" TIMESTAMPTZ(6),
    "evolved_at" TIMESTAMPTZ(6),
    "costume_slug" VARCHAR(50),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "companion_pet_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "companion_pet_user_id_key" ON "gamification"."companion_pet"("user_id");
