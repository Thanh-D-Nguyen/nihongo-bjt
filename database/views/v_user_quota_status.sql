-- Perf: single lateral for subscription + plan slug removes extra join to monetization.plan.
CREATE OR REPLACE VIEW reporting.v_user_quota_status AS
SELECT
  uc.id AS usage_counter_id,
  uc.user_id,
  uc.quota_key,
  uc.window_key,
  uc.value AS consumed,
  uc.updated_at AS counter_updated_at,
  ql.plan_limit,
  ql.quota_window_code,
  us.subscription_id,
  us.subscription_status,
  us.plan_slug
FROM monetization.usage_counter uc
LEFT JOIN LATERAL (
  SELECT
    s.id AS subscription_id,
    s.status AS subscription_status,
    pl.slug AS plan_slug,
    s.plan_id
  FROM monetization.user_subscription s
  JOIN monetization.plan pl ON pl.id = s.plan_id
  WHERE s.user_id = uc.user_id
    AND s.status IN ('active', 'trialing')
  ORDER BY s.updated_at DESC
  LIMIT 1
) us ON TRUE
LEFT JOIN LATERAL (
  SELECT pq.limit_value AS plan_limit, qp.window_code AS quota_window_code
  FROM monetization.plan_quota pq
  JOIN monetization.quota_policy qp ON qp.id = pq.quota_policy_id
  WHERE us.plan_id IS NOT NULL
    AND pq.plan_id = us.plan_id
    AND qp.key = uc.quota_key
  LIMIT 1
) ql ON TRUE;

COMMENT ON VIEW reporting.v_user_quota_status IS
  'Quota lens: usage_counter + latest active subscription (with plan_slug) + matching plan_quota row for quota_policy.key.';
