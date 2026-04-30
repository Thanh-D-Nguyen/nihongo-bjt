-- Admin actors with aggregated role and permission codes (RBAC overview).
CREATE OR REPLACE VIEW reporting.v_admin_user_summary AS
SELECT
  a.id AS admin_actor_id,
  a.email,
  a.display_name,
  a.status,
  a.keycloak_subject,
  a.created_at,
  a.updated_at,
  (
    SELECT string_agg(sub.code, ', ' ORDER BY sub.code)
    FROM (
      SELECT DISTINCT r.code
      FROM authz.admin_actor_role ar
      JOIN authz.admin_role r ON r.id = ar.role_id
      WHERE ar.actor_id = a.id
    ) AS sub
  ) AS role_codes,
  (
    SELECT string_agg(sub.code, ', ' ORDER BY sub.code)
    FROM (
      SELECT DISTINCT p.code
      FROM authz.admin_actor_role ar
      JOIN authz.admin_role r ON r.id = ar.role_id
      JOIN authz.admin_role_permission rp ON rp.role_id = r.id
      JOIN authz.admin_permission p ON p.id = rp.permission_id
      WHERE ar.actor_id = a.id
    ) AS sub
  ) AS permission_codes
FROM authz.admin_actor a;

COMMENT ON VIEW reporting.v_admin_user_summary IS
  'Admin directory: actor row with comma-sorted distinct role codes and expanded permission codes for IAM screens.';
