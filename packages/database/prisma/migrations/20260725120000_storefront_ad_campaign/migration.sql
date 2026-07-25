INSERT INTO "monetization"."ad_provider_config"
  ("id", "key", "type", "enabled", "status", "config", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'local', 'local', true, 'ok', '{"label":"local"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "monetization"."ad_placement"
  ("id", "code", "label_key", "config", "active", "created_at", "updated_at")
VALUES
  (
    gen_random_uuid(),
    'home_feed_inline',
    'ads.placement.home_feed_inline',
    '{"allowedPlanSlugs":["free","basic","standard","premium"],"learningSafe":true,"location":"inline","maxPerDay":12,"providerKey":"local","surface":"home"}'::jsonb,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    gen_random_uuid(),
    'flashcard_library_inline',
    'ads.placement.flashcard_library_inline',
    '{"allowedPlanSlugs":["free","basic","standard","premium"],"learningSafe":true,"location":"inline","maxPerDay":8,"providerKey":"local","surface":"flashcards_library"}'::jsonb,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    gen_random_uuid(),
    'dictionary_result_inline',
    'ads.placement.dictionary_result_inline',
    '{"allowedPlanSlugs":["free","basic","standard","premium"],"learningSafe":true,"location":"inline","maxPerDay":20,"providerKey":"local","surface":"dictionary"}'::jsonb,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "monetization"."ad_campaign"
  (
    "id",
    "name",
    "status",
    "provider_key",
    "placement_codes",
    "priority",
    "creative_type",
    "destination_url",
    "policy_status",
    "created_at",
    "updated_at"
  )
SELECT
  gen_random_uuid(),
  'Leetuyt Storefront',
  'active',
  'local',
  '["home_feed_inline","flashcard_library_inline","dictionary_result_inline"]'::jsonb,
  100,
  'storefront',
  'https://collshp.com/leetuyt710331?view=storefront',
  'ok',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM "monetization"."ad_campaign"
  WHERE "name" = 'Leetuyt Storefront'
    AND "provider_key" = 'local'
);
