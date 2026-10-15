CREATE TABLE "content"."nhk_news_config" (
  "locale" VARCHAR(8) NOT NULL,
  "default_type" VARCHAR(16) NOT NULL DEFAULT 'easy',
  "easy_enabled" BOOLEAN NOT NULL DEFAULT true,
  "easy_feed_url" TEXT NOT NULL DEFAULT 'https://www3.nhk.or.jp/news/easy/news-list.json',
  "normal_enabled" BOOLEAN NOT NULL DEFAULT false,
  "normal_feed_url" TEXT NOT NULL DEFAULT 'https://www3.nhk.or.jp/rss/news/cat0.xml',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "nhk_news_config_pkey" PRIMARY KEY ("locale"),
  CONSTRAINT "nhk_news_config_default_type_check" CHECK ("default_type" IN ('easy', 'normal')),
  CONSTRAINT "nhk_news_config_locale_check" CHECK ("locale" IN ('en', 'vi', 'ja'))
);

INSERT INTO "content"."nhk_news_config" ("locale") VALUES ('en'), ('vi'), ('ja');
