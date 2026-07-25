UPDATE "monetization"."ad_placement"
SET
  "config" = jsonb_set(
    "config",
    '{allowedPlanSlugs}',
    '["free","plus","basic","standard","premium"]'::jsonb,
    true
  ),
  "updated_at" = CURRENT_TIMESTAMP
WHERE "code" IN (
  'home_feed_inline',
  'flashcard_library_inline',
  'dictionary_result_inline'
);

INSERT INTO "monetization"."monetization_audit_log"
  ("actor_kind", "action", "payload")
VALUES
  (
    'system',
    'storefront_placement_plans_corrected',
    jsonb_build_object(
      'allowedPlanSlugs', '["free","plus","basic","standard","premium"]'::jsonb,
      'reason', 'Align managed ad placements with the canonical free/plus/standard plan slugs.'
    )
  );
