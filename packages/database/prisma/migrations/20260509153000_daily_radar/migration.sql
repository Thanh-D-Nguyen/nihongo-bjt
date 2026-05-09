CREATE TABLE "daily"."daily_radar_module_config" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "module_key" VARCHAR(80) NOT NULL,
    "title_vi" TEXT NOT NULL,
    "title_ja" TEXT NOT NULL,
    "title_en" TEXT,
    "description_vi" TEXT NOT NULL,
    "description_ja" TEXT,
    "category" VARCHAR(32) NOT NULL,
    "module_type" VARCHAR(32) NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'draft',
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_spotlight_eligible" BOOLEAN NOT NULL DEFAULT false,
    "default_priority" INTEGER NOT NULL DEFAULT 0,
    "icon_key" VARCHAR(64),
    "visual_theme" VARCHAR(64),
    "route_path" TEXT,
    "external_url" TEXT,
    "disclaimer_vi" TEXT,
    "disclaimer_ja" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_radar_module_config_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "daily"."daily_radar_card" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "module_config_id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "title_vi" TEXT NOT NULL,
    "title_ja" TEXT,
    "subtitle_vi" TEXT,
    "description_vi" TEXT NOT NULL,
    "recommendation_reason_vi" TEXT,
    "category" VARCHAR(32) NOT NULL,
    "module_type" VARCHAR(32) NOT NULL,
    "badge_text_vi" VARCHAR(64),
    "estimated_minutes" INTEGER,
    "level_label" VARCHAR(64),
    "cta_label_vi" TEXT NOT NULL,
    "cta_label_ja" TEXT,
    "target_route" TEXT,
    "target_entity_type" VARCHAR(80),
    "target_entity_id" VARCHAR(120),
    "image_url" TEXT,
    "icon_key" VARCHAR(64),
    "visual_theme" VARCHAR(64),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "starts_at" TIMESTAMPTZ(6),
    "ends_at" TIMESTAMPTZ(6),
    "status" VARCHAR(32) NOT NULL DEFAULT 'draft',
    "is_spotlight" BOOLEAN NOT NULL DEFAULT false,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_radar_card_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "daily_radar_module_config_module_key_key" ON "daily"."daily_radar_module_config"("module_key");
CREATE INDEX "idx_daily_radar_module_public" ON "daily"."daily_radar_module_config"("status", "is_enabled", "default_priority");
CREATE INDEX "idx_daily_radar_module_category_status" ON "daily"."daily_radar_module_config"("category", "status");

CREATE UNIQUE INDEX "daily_radar_card_slug_key" ON "daily"."daily_radar_card"("slug");
CREATE INDEX "idx_daily_radar_card_public_order" ON "daily"."daily_radar_card"("status", "is_pinned", "priority", "updated_at");
CREATE INDEX "idx_daily_radar_card_category_status" ON "daily"."daily_radar_card"("category", "status", "priority");
CREATE INDEX "idx_daily_radar_card_module_status" ON "daily"."daily_radar_card"("module_config_id", "status");
CREATE INDEX "idx_daily_radar_card_spotlight" ON "daily"."daily_radar_card"("is_spotlight", "status", "priority");

ALTER TABLE "daily"."daily_radar_card"
ADD CONSTRAINT "daily_radar_card_module_config_id_fkey"
FOREIGN KEY ("module_config_id") REFERENCES "daily"."daily_radar_module_config"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
