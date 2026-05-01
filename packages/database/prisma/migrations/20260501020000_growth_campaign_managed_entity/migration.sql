-- Growth Campaign managed entity. The growth admin previously exposed only ad campaigns and share
-- templates; operators need a real CRUD entity for in-product growth pushes (email/push/in-app)
-- with audience filters, schedule, content body, CTA, and tracking. Lives in `growth` alongside
-- share/referral assets. Lifecycle: draft → scheduled → active → ended → archived.

CREATE TABLE "growth"."growth_campaign" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(32) NOT NULL DEFAULT 'draft',
    "channel" VARCHAR(32) NOT NULL,
    "audience" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "cta" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "content_body" TEXT,
    "tracking_utm" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "schedule_start" TIMESTAMPTZ(6),
    "schedule_end" TIMESTAMPTZ(6),
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "growth_campaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_growth_campaign_status_schedule" ON "growth"."growth_campaign" ("status", "schedule_start");
CREATE INDEX "idx_growth_campaign_updated_at" ON "growth"."growth_campaign" ("updated_at");
