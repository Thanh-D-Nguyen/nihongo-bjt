CREATE SCHEMA IF NOT EXISTS admin;

CREATE TABLE IF NOT EXISTS admin.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action varchar(120) NOT NULL,
  admin_user_id uuid NOT NULL,
  resource_type varchar(80) NOT NULL,
  resource_id text,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT fk_admin_audit_log_actor
    FOREIGN KEY (admin_user_id)
    REFERENCES authz.admin_actor(id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor_created_at
  ON admin.audit_log (admin_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_resource_created_at
  ON admin.audit_log (resource_type, created_at DESC);
