CREATE TABLE "ops"."push_subscription" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" VARCHAR(255) NOT NULL,
    "auth" VARCHAR(255) NOT NULL,
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "push_subscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_push_sub_user_endpoint" ON "ops"."push_subscription"("user_id", "endpoint");
CREATE INDEX "idx_push_sub_user" ON "ops"."push_subscription"("user_id");
