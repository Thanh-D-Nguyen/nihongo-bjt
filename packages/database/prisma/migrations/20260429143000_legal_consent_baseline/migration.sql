CREATE SCHEMA IF NOT EXISTS legal;

CREATE TABLE IF NOT EXISTS legal.consent_record (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profile.user_profile(id) ON DELETE CASCADE,
  consent_key varchar(64) NOT NULL,
  policy_version varchar(40) NOT NULL,
  accepted_at timestamptz(6) NOT NULL DEFAULT now(),
  source varchar(32) NOT NULL DEFAULT 'web',
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  UNIQUE (user_id, consent_key, policy_version)
);

CREATE INDEX IF NOT EXISTS idx_legal_consent_user_key_created
  ON legal.consent_record(user_id, consent_key, created_at DESC);
