UPDATE "monetization"."ad_provider_config"
SET
  "type" = 'local',
  "enabled" = true,
  "status" = 'ok',
  "updated_at" = CURRENT_TIMESTAMP
WHERE "key" = 'local';

UPDATE "monetization"."ad_placement"
SET
  "active" = true,
  "config" = "config" || jsonb_build_object(
    'allowedPlanSlugs', '["free","basic","standard","premium"]'::jsonb,
    'providerKey', 'local'
  ),
  "updated_at" = CURRENT_TIMESTAMP
WHERE "code" IN (
  'home_feed_inline',
  'flashcard_library_inline',
  'dictionary_result_inline'
);

UPDATE "monetization"."ad_campaign"
SET
  "status" = 'active',
  "provider_key" = 'local',
  "placement_codes" = '["home_feed_inline","flashcard_library_inline","dictionary_result_inline"]'::jsonb,
  "start_at" = NULL,
  "end_at" = NULL,
  "priority" = 100,
  "creative_type" = 'storefront',
  "destination_url" = 'https://collshp.com/leetuyt710331?view=storefront',
  "target_locale" = NULL,
  "target_plan_slug" = NULL,
  "max_impressions" = NULL,
  "policy_status" = 'ok',
  "updated_at" = CURRENT_TIMESTAMP
WHERE "name" = 'Leetuyt Storefront'
  AND "provider_key" = 'local';

INSERT INTO "monetization"."monetization_audit_log"
  ("actor_kind", "action", "payload")
VALUES
  (
    'system',
    'storefront_campaign_activated',
    jsonb_build_object(
      'campaignName', 'Leetuyt Storefront',
      'destinationUrl', 'https://collshp.com/leetuyt710331?view=storefront',
      'placements', '["home_feed_inline","flashcard_library_inline","dictionary_result_inline"]'::jsonb,
      'reason', 'Normalize existing managed ad records that predated the storefront campaign.'
    )
  );
