INSERT INTO authz.admin_permission (code, description)
VALUES
  ('assessment.manage', 'Create, update, tag, and delete assessment questions.'),
  ('assessment.review', 'Review proposed assessment question edits.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO authz.admin_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM authz.admin_role r
CROSS JOIN authz.admin_permission p
WHERE r.code = 'editor.exam'
  AND p.code IN ('assessment.manage', 'assessment.review')
ON CONFLICT (role_id, permission_id) DO NOTHING;
