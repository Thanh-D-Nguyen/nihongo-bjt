-- Phase 12: social OAuth identity, sharing, referrals
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS growth;

CREATE TABLE auth.identity_provider_account (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profile.user_profile(id) ON DELETE CASCADE,
  provider varchar(32) NOT NULL,
  provider_subject varchar(255) NOT NULL,
  email_at_link varchar(255),
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT uq_idp_provider_subject UNIQUE (provider, provider_subject)
);
CREATE INDEX idx_idp_user ON auth.identity_provider_account (user_id);

CREATE TABLE auth.login_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  provider varchar(32) NOT NULL,
  event_type varchar(64) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE INDEX idx_login_event_user_created ON auth.login_event (user_id, created_at);

CREATE TABLE auth.auth_link_code (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash varchar(64) NOT NULL,
  user_id uuid NOT NULL REFERENCES profile.user_profile(id) ON DELETE CASCADE,
  expires_at timestamptz(6) NOT NULL,
  used_at timestamptz(6),
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT uq_auth_link_code_hash UNIQUE (code_hash)
);
CREATE INDEX idx_auth_link_user_created ON auth.auth_link_code (user_id, created_at);

CREATE TABLE growth.share_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(64) NOT NULL,
  kind varchar(64) NOT NULL,
  version integer NOT NULL DEFAULT 1,
  config jsonb NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX share_template_slug_key ON growth.share_template (slug);

CREATE TABLE growth.share_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profile.user_profile(id) ON DELETE CASCADE,
  template_id uuid REFERENCES growth.share_template(id) ON DELETE SET NULL,
  public_token varchar(64) NOT NULL,
  kind varchar(64) NOT NULL,
  summary_payload jsonb NOT NULL,
  expires_at timestamptz(6),
  created_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX share_item_public_token_key ON growth.share_item (public_token);
CREATE INDEX idx_share_item_user_created ON growth.share_item (user_id, created_at);

CREATE TABLE growth.share_card_asset (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_item_id uuid NOT NULL REFERENCES growth.share_item(id) ON DELETE CASCADE,
  object_key text NOT NULL,
  mime_type varchar(64) NOT NULL,
  width integer NOT NULL,
  height integer NOT NULL,
  created_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE INDEX idx_share_card_item ON growth.share_card_asset (share_item_id);

CREATE TABLE growth.referral_code (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profile.user_profile(id) ON DELETE CASCADE,
  code varchar(32) NOT NULL,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT uq_referral_code_user UNIQUE (user_id),
  CONSTRAINT uq_referral_code_value UNIQUE (code)
);

CREATE TABLE growth.referral_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES profile.user_profile(id) ON DELETE CASCADE,
  referred_user_id uuid REFERENCES profile.user_profile(id) ON DELETE SET NULL,
  code varchar(32) NOT NULL,
  kind varchar(32) NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE INDEX idx_referral_event_referrer ON growth.referral_event (referrer_user_id, created_at);
CREATE INDEX idx_referral_event_code ON growth.referral_event (code, created_at);

CREATE TABLE growth.referral_quota_credit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profile.user_profile(id) ON DELETE CASCADE,
  quota_key varchar(120) NOT NULL,
  amount integer NOT NULL,
  reason varchar(64) NOT NULL,
  valid_until timestamptz(6) NOT NULL,
  created_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE INDEX idx_ref_qc_user_valid ON growth.referral_quota_credit (user_id, valid_until);
