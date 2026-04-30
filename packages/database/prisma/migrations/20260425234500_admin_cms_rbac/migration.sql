CREATE SCHEMA IF NOT EXISTS authz;
CREATE SCHEMA IF NOT EXISTS ops;
CREATE SCHEMA IF NOT EXISTS profile;

CREATE TABLE authz.admin_actor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keycloak_subject text UNIQUE,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'active',
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_actor_status ON authz.admin_actor (status);

CREATE TABLE authz.admin_role (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(80) NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  status varchar(32) NOT NULL DEFAULT 'active',
  created_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_role_status ON authz.admin_role (status);

CREATE TABLE authz.admin_permission (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(120) NOT NULL UNIQUE,
  description text,
  created_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE TABLE authz.admin_actor_role (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES authz.admin_actor(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES authz.admin_role(id) ON DELETE CASCADE,
  granted_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_admin_actor_role ON authz.admin_actor_role (actor_id, role_id);

CREATE TABLE authz.admin_role_permission (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES authz.admin_role(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES authz.admin_permission(id) ON DELETE CASCADE,
  granted_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_admin_role_permission ON authz.admin_role_permission (role_id, permission_id);

CREATE TABLE ops.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES authz.admin_actor(id) ON DELETE RESTRICT,
  action varchar(120) NOT NULL,
  target_type varchar(80) NOT NULL,
  target_id text NOT NULL,
  reason text,
  before jsonb,
  after jsonb,
  trace_id varchar(120),
  created_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_audit_actor_created_at ON ops.admin_audit_log (actor_id, created_at);
CREATE INDEX idx_admin_audit_target ON ops.admin_audit_log (target_type, target_id);

CREATE TABLE profile.user_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keycloak_subject text UNIQUE,
  email text UNIQUE,
  display_name text NOT NULL,
  avatar_asset_id uuid REFERENCES media.asset(id) ON DELETE SET NULL,
  ui_locale varchar(16) NOT NULL DEFAULT 'vi',
  explanation_locale varchar(16) NOT NULL DEFAULT 'vi',
  timezone varchar(80) NOT NULL DEFAULT 'Asia/Tokyo',
  target_bjt_band varchar(16),
  daily_goal_cards integer NOT NULL DEFAULT 20,
  learning_personality varchar(64),
  privacy_level varchar(32) NOT NULL DEFAULT 'standard',
  status varchar(32) NOT NULL DEFAULT 'active',
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_profile_status_created_at ON profile.user_profile (status, created_at);
