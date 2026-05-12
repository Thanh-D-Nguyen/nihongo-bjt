-- BJT lesson navigation and persistent NHK article storage.

CREATE TABLE "curriculum"."bjt_lesson" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "level_code" VARCHAR(4) NOT NULL,
  "sort_order" INTEGER NOT NULL,
  "slug" VARCHAR(80) NOT NULL,
  "title_vi" VARCHAR(200) NOT NULL,
  "title_ja" VARCHAR(200) NOT NULL,
  "description_vi" TEXT,
  "description_ja" TEXT,
  "status" VARCHAR(32) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "bjt_lesson_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "curriculum"."bjt_lesson_item" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "lesson_id" UUID NOT NULL,
  "content_type" VARCHAR(20) NOT NULL,
  "content_id" UUID NOT NULL,
  "sort_order" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "bjt_lesson_item_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "content"."nhk_article" (
  "id" VARCHAR(64) NOT NULL,
  "source_type" VARCHAR(16) NOT NULL,
  "title" TEXT NOT NULL,
  "title_with_ruby" TEXT,
  "url" TEXT NOT NULL,
  "image_url" TEXT,
  "audio_url" TEXT,
  "difficulty" VARCHAR(32),
  "body_html" TEXT,
  "body_plain" TEXT,
  "vocabulary" JSONB NOT NULL DEFAULT '[]',
  "published_at" TIMESTAMPTZ(6) NOT NULL,
  "fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "nhk_article_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "learning"."nhk_reading_progress" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" VARCHAR(128) NOT NULL,
  "article_id" VARCHAR(64) NOT NULL,
  "read_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "read_time_sec" INTEGER,
  "completed" BOOLEAN NOT NULL DEFAULT false,

  CONSTRAINT "nhk_reading_progress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "learning"."nhk_bookmark" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" VARCHAR(128) NOT NULL,
  "article_id" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "nhk_bookmark_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bjt_lesson_slug_key"
  ON "curriculum"."bjt_lesson"("slug");

CREATE INDEX "idx_bjt_lesson_level_status"
  ON "curriculum"."bjt_lesson"("level_code", "status");

CREATE UNIQUE INDEX "uq_bjt_lesson_level_order"
  ON "curriculum"."bjt_lesson"("level_code", "sort_order");

CREATE INDEX "idx_bjt_lesson_item_order"
  ON "curriculum"."bjt_lesson_item"("lesson_id", "sort_order");

CREATE INDEX "idx_bjt_lesson_item_content"
  ON "curriculum"."bjt_lesson_item"("content_type", "content_id");

CREATE UNIQUE INDEX "uq_bjt_lesson_item_unique"
  ON "curriculum"."bjt_lesson_item"("lesson_id", "content_type", "content_id");

CREATE INDEX "idx_nhk_article_source_published"
  ON "content"."nhk_article"("source_type", "published_at" DESC);

CREATE INDEX "idx_nhk_reading_progress_user"
  ON "learning"."nhk_reading_progress"("user_id", "read_at" DESC);

CREATE UNIQUE INDEX "uq_nhk_reading_progress_user_article"
  ON "learning"."nhk_reading_progress"("user_id", "article_id");

CREATE INDEX "idx_nhk_bookmark_user"
  ON "learning"."nhk_bookmark"("user_id", "created_at" DESC);

CREATE UNIQUE INDEX "uq_nhk_bookmark_user_article"
  ON "learning"."nhk_bookmark"("user_id", "article_id");

ALTER TABLE "curriculum"."bjt_lesson_item"
  ADD CONSTRAINT "bjt_lesson_item_lesson_id_fkey"
  FOREIGN KEY ("lesson_id") REFERENCES "curriculum"."bjt_lesson"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "learning"."nhk_reading_progress"
  ADD CONSTRAINT "nhk_reading_progress_article_id_fkey"
  FOREIGN KEY ("article_id") REFERENCES "content"."nhk_article"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "learning"."nhk_bookmark"
  ADD CONSTRAINT "nhk_bookmark_article_id_fkey"
  FOREIGN KEY ("article_id") REFERENCES "content"."nhk_article"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
