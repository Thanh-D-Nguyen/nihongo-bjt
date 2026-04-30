-- CreateTable
CREATE TABLE "learning"."learning_path" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(128) NOT NULL,
    "title_vi" TEXT NOT NULL,
    "title_ja" TEXT,
    "description_vi" TEXT,
    "description_ja" TEXT,
    "target_level" VARCHAR(32),
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(32) NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "learning_path_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."competency" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(64) NOT NULL,
    "title_vi" TEXT NOT NULL,
    "title_ja" TEXT,
    "description_vi" TEXT,
    "level" VARCHAR(32) NOT NULL DEFAULT 'intermediate',
    "status" VARCHAR(32) NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "competency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content"."content_version" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity_type" VARCHAR(64) NOT NULL,
    "entity_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "change_summary" TEXT,
    "snapshot" JSONB NOT NULL,
    "author_user_id" UUID,
    "status" VARCHAR(32) NOT NULL DEFAULT 'current',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content"."content_enrichment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity_type" VARCHAR(64) NOT NULL,
    "entity_id" UUID NOT NULL,
    "enrichment_type" VARCHAR(64) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "result" JSONB,
    "error_message" TEXT,
    "processed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "content_enrichment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "learning_path_slug_key" ON "learning"."learning_path"("slug");

-- CreateIndex
CREATE INDEX "idx_learning_path_status_order" ON "learning"."learning_path"("status", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "competency_code_key" ON "learning"."competency"("code");

-- CreateIndex
CREATE INDEX "idx_competency_status_level" ON "learning"."competency"("status", "level");

-- CreateIndex
CREATE UNIQUE INDEX "uq_content_version_entity_version" ON "content"."content_version"("entity_type", "entity_id", "version_number");

-- CreateIndex
CREATE INDEX "idx_content_version_entity" ON "content"."content_version"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "idx_content_enrichment_status_priority" ON "content"."content_enrichment"("status", "priority");

-- CreateIndex
CREATE INDEX "idx_content_enrichment_entity" ON "content"."content_enrichment"("entity_type", "entity_id");
