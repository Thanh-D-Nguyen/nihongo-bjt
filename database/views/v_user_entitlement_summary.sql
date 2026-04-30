-- Perf: entitlement_keys aggregated once per plan_id, then joined to subscriptions (dedupes array work).
CREATE OR REPLACE VIEW reporting.v_user_entitlement_summary AS
SELECT
  us.user_id,
  us.id AS subscription_id,
  us.status AS subscription_status,
  us.provider,
  us.current_period_start,
  us.current_period_end,
  us.cancel_at_period_end,
  p.id AS plan_id,
  p.slug AS plan_slug,
  p.name_key AS plan_name_key,
  p.status AS plan_status,
  coalesce(pk.entitlement_keys, ARRAY[]::text[]) AS entitlement_keys
FROM monetization.user_subscription us
JOIN monetization.plan p ON p.id = us.plan_id
LEFT JOIN (
  SELECT
    pe.plan_id,
    array_agg(ed.key ORDER BY ed.key) AS entitlement_keys
  FROM monetization.plan_entitlement pe
  JOIN monetization.entitlement_definition ed ON ed.id = pe.entitlement_id
  GROUP BY pe.plan_id
) pk ON pk.plan_id = us.plan_id
WHERE us.status IN ('active', 'trialing');

COMMENT ON VIEW reporting.v_user_entitlement_summary IS
  'Active/trialing subscriptions with plan-level entitlement key arrays (single array_agg per plan).';
