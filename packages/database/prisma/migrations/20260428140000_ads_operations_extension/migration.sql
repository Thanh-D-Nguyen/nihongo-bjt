-- Ads operations: providers, campaigns, safety rules, impression campaign link, ads personalization opt-in.

CREATE TABLE monetization.ad_provider_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key varchar(64) NOT NULL UNIQUE,
  type varchar(32) NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  status varchar(32) NOT NULL DEFAULT 'ok',
  last_sync_at timestamptz(6),
  config jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE TABLE monetization.ad_campaign (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(200) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'draft',
  provider_key varchar(64) NOT NULL,
  placement_codes jsonb NOT NULL DEFAULT '[]',
  start_at timestamptz(6),
  end_at timestamptz(6),
  priority int NOT NULL DEFAULT 0,
  creative_type varchar(64) NOT NULL DEFAULT 'placeholder',
  destination_url varchar(2000),
  target_locale varchar(16),
  target_plan_slug varchar(64),
  max_impressions int,
  policy_status varchar(32) NOT NULL DEFAULT 'pending',
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE INDEX idx_ad_campaign_status_dates ON monetization.ad_campaign (status, start_at, end_at);

CREATE TABLE monetization.ad_safety_rule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key varchar(120) NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz(6) NOT NULL DEFAULT now()
);

ALTER TABLE monetization.ad_impression
  ADD COLUMN campaign_id uuid;

ALTER TABLE monetization.ad_impression
  ADD CONSTRAINT fk_ad_impression_campaign
  FOREIGN KEY (campaign_id) REFERENCES monetization.ad_campaign (id) ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE INDEX idx_ad_impression_campaign_created ON monetization.ad_impression (campaign_id, created_at);

ALTER TABLE profile.user_profile
  ADD COLUMN ads_personalization_opt_in boolean NOT NULL DEFAULT false;
