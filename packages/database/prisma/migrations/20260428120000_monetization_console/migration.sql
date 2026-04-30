-- Admin monetization console: plan display config, entitlements category, trial end,
-- quota overrides, promotion coupons.
ALTER TABLE monetization.plan
  ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE monetization.entitlement_definition
  ADD COLUMN IF NOT EXISTS category varchar(40) NULL;

ALTER TABLE monetization.user_subscription
  ADD COLUMN IF NOT EXISTS trial_end timestamptz(6) NULL;

CREATE TABLE IF NOT EXISTS monetization.quota_user_override (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profile.user_profile (id) ON DELETE CASCADE,
  quota_key varchar(120) NOT NULL,
  limit_value integer NOT NULL,
  reason varchar(500) NOT NULL,
  expires_at timestamptz(6) NULL,
  created_by_actor_id uuid NULL,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT uq_quota_user_override_user_key UNIQUE (user_id, quota_key)
);
CREATE INDEX IF NOT EXISTS idx_quota_user_override_user ON monetization.quota_user_override (user_id);
CREATE INDEX IF NOT EXISTS idx_quota_user_override_key ON monetization.quota_user_override (quota_key);

CREATE TABLE IF NOT EXISTS monetization.promotion_coupon (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(64) NOT NULL,
  discount_type varchar(24) NOT NULL,
  discount_value integer NOT NULL,
  allowed_plan_slugs jsonb NOT NULL DEFAULT '[]'::jsonb,
  max_redemptions integer NULL,
  redemption_count integer NOT NULL DEFAULT 0,
  status varchar(32) NOT NULL DEFAULT 'draft',
  starts_at timestamptz(6) NULL,
  ends_at timestamptz(6) NULL,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS promotion_coupon_code_key ON monetization.promotion_coupon (code);

ALTER TABLE monetization.quota_policy
  ADD COLUMN IF NOT EXISTS warn_threshold_percent integer NULL;
