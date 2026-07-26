DO $$
DECLARE
  previous_state jsonb;
  current_state jsonb;
BEGIN
  SELECT jsonb_build_object(
    'enabled', "enabled",
    'killSwitch', "kill_switch",
    'scope', "scope"
  )
  INTO previous_state
  FROM "ops"."feature_flag"
  WHERE "key" = 'quiz.official_simulation.enabled';

  INSERT INTO "ops"."feature_flag"
    ("key", "description", "enabled", "kill_switch", "scope", "rules", "created_at", "updated_at")
  VALUES
    (
      'quiz.official_simulation.enabled',
      'Enable official-format BJT simulation.',
      true,
      false,
      'global',
      '{}'::jsonb,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  ON CONFLICT ("key") DO UPDATE
  SET
    "description" = EXCLUDED."description",
    "enabled" = true,
    "updated_at" = CURRENT_TIMESTAMP;

  SELECT jsonb_build_object(
    'enabled', "enabled",
    'killSwitch', "kill_switch",
    'scope', "scope"
  )
  INTO current_state
  FROM "ops"."feature_flag"
  WHERE "key" = 'quiz.official_simulation.enabled';

  INSERT INTO "ops"."feature_flag_audit"
    ("flag_key", "action", "before", "after", "reason")
  VALUES
    (
      'quiz.official_simulation.enabled',
      'deployment_enable',
      previous_state,
      current_state,
      'Publish the production-ready official-format BJT mock forms while preserving the emergency kill switch.'
    );
END
$$;
