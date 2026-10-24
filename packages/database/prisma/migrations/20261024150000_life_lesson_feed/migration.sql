CREATE TABLE "daily"."life_lesson" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "card_key" VARCHAR(180) NOT NULL,
  "topic" VARCHAR(24) NOT NULL,
  "city_id" VARCHAR(24),
  "valid_from" DATE NOT NULL,
  "valid_until" DATE NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'draft',
  "rights_status" VARCHAR(16) NOT NULL DEFAULT 'unknown',
  "reviewer_id" UUID,
  "source_url" TEXT,
  "card" JSONB NOT NULL,
  "source_expires_at" TIMESTAMPTZ(6) NOT NULL,
  "published_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "life_lesson_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "life_lesson_dates_check" CHECK ("valid_until">="valid_from"),
  CONSTRAINT "life_lesson_status_check" CHECK ("status" IN ('draft','reviewed','published')),
  CONSTRAINT "life_lesson_rights_check" CHECK ("rights_status" IN ('unknown','cleared','blocked')),
  CONSTRAINT "life_lesson_topic_check" CHECK ("topic" IN ('weather','transit','shopping','news','food','culture','money','lottery')),
  CONSTRAINT "life_lesson_publish_check" CHECK ("status" <> 'published' OR ("rights_status"='cleared' AND "reviewer_id" IS NOT NULL)),
  CONSTRAINT "life_lesson_city_check" CHECK ("city_id" IS NULL OR "city_id" IN ('tokyo','yokohama','osaka','nagoya','kyoto','sapporo','sendai','hiroshima','fukuoka','naha'))
);
CREATE UNIQUE INDEX "life_lesson_card_key_key" ON "daily"."life_lesson"("card_key");
CREATE INDEX "idx_life_lesson_feed" ON "daily"."life_lesson"("status","rights_status","topic","updated_at" DESC,"card_key");
CREATE INDEX "idx_life_lesson_unexpired" ON "daily"."life_lesson"("status","rights_status","topic","source_expires_at");
