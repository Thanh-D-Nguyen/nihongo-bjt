-- Login bonus chain
CREATE TABLE "gamification"."login_bonus_chain" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "chain_day" SMALLINT NOT NULL DEFAULT 1,
    "last_claim_date" DATE,
    "chain_start_date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "login_bonus_chain_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_login_bonus_chain_user" ON "gamification"."login_bonus_chain"("user_id");

-- Login bonus claims
CREATE TABLE "gamification"."login_bonus_claim" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "chain_day" SMALLINT NOT NULL,
    "reward_type" VARCHAR(32) NOT NULL,
    "reward_value" VARCHAR(255) NOT NULL,
    "claimed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "login_bonus_claim_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_login_bonus_claim_user" ON "gamification"."login_bonus_claim"("user_id", "claimed_at");
