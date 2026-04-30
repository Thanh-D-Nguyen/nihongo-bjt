-- Phase 11: plans, entitlements, quotas, subscriptions, usage, ads, monetization audit
CREATE SCHEMA IF NOT EXISTS monetization;

CREATE TABLE monetization.plan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(64) NOT NULL,
  name_key varchar(160) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'active',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX plan_slug_key ON monetization.plan (slug);

CREATE TABLE monetization.entitlement_definition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key varchar(120) NOT NULL,
  description text,
  created_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX entitlement_definition_key_key ON monetization.entitlement_definition (key);

CREATE TABLE monetization.plan_entitlement (
  plan_id uuid NOT NULL REFERENCES monetization.plan(id) ON DELETE CASCADE,
  entitlement_id uuid NOT NULL REFERENCES monetization.entitlement_definition(id) ON DELETE CASCADE,
  PRIMARY KEY (plan_id, entitlement_id)
);

CREATE TABLE monetization.quota_policy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key varchar(120) NOT NULL,
  window_code varchar(32) NOT NULL,
  description text,
  created_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX quota_policy_key_key ON monetization.quota_policy (key);

CREATE TABLE monetization.plan_quota (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES monetization.plan(id) ON DELETE CASCADE,
  quota_policy_id uuid NOT NULL REFERENCES monetization.quota_policy(id) ON DELETE CASCADE,
  limit_value integer NOT NULL,
  CONSTRAINT uq_plan_quota_plan_policy UNIQUE (plan_id, quota_policy_id)
);

CREATE TABLE monetization.user_subscription (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profile.user_profile(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES monetization.plan(id) ON DELETE RESTRICT,
  status varchar(32) NOT NULL,
  provider varchar(32) NOT NULL DEFAULT 'local',
  provider_ref varchar(255),
  current_period_start timestamptz(6),
  current_period_end timestamptz(6),
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_sub_user_status ON monetization.user_subscription (user_id, status);

CREATE TABLE monetization.subscription_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES monetization.user_subscription(id) ON DELETE CASCADE,
  kind varchar(64) NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE INDEX idx_sub_event_sub_created ON monetization.subscription_event (subscription_id, created_at);

CREATE TABLE monetization.usage_counter (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profile.user_profile(id) ON DELETE CASCADE,
  quota_key varchar(120) NOT NULL,
  window_key varchar(32) NOT NULL,
  value integer NOT NULL DEFAULT 0,
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT uq_usage_counter_user_quota_window UNIQUE (user_id, quota_key, window_key)
);
CREATE INDEX idx_usage_counter_user_quota ON monetization.usage_counter (user_id, quota_key);

CREATE TABLE monetization.usage_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profile.user_profile(id) ON DELETE CASCADE,
  quota_key varchar(120) NOT NULL,
  window_key varchar(32) NOT NULL,
  delta integer NOT NULL,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}',
  usage_counter_id uuid REFERENCES monetization.usage_counter(id) ON DELETE SET NULL
);
CREATE INDEX idx_usage_event_user_created ON monetization.usage_event (user_id, created_at);

CREATE TABLE monetization.monetization_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  actor_kind varchar(32) NOT NULL,
  action varchar(120) NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE INDEX idx_mon_audit_user_created ON monetization.monetization_audit_log (user_id, created_at);

CREATE TABLE monetization.ad_placement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(64) NOT NULL,
  label_key varchar(160),
  config jsonb NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ad_placement_code_key ON monetization.ad_placement (code);

CREATE TABLE monetization.ad_impression (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  placement_id uuid NOT NULL REFERENCES monetization.ad_placement(id) ON DELETE CASCADE,
  kind varchar(32) NOT NULL,
  decision_key varchar(120),
  client_context jsonb,
  created_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE INDEX idx_ad_impression_user_created ON monetization.ad_impression (user_id, created_at);
CREATE INDEX idx_ad_impression_place_created ON monetization.ad_impression (placement_id, created_at);
