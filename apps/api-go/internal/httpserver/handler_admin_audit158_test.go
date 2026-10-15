package httpserver

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAudit158IAMListContractsReturnPersistedRows(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit158-iam-%s@example.com", actorID[:8]), "AUDIT-158 IAM")
	token := createAdminSession(t, sessions, actorID)
	call := func(path string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}
	if res := call("/api/admin/iam/roles"); res.Code != http.StatusForbidden {
		t.Fatalf("IAM reads require iam.manage: status=%d body=%s", res.Code, res.Body.String())
	}

	roleCode := "audit158-role-" + actorID[:8]
	permissionCode := "audit158.permission." + actorID[:8]
	grantAdminPermission(t, db, actorID, "iam.manage")
	roleID, permissionID := newUUID(t), newUUID(t)
	seedAdminRole(t, db, roleID, roleCode, "AUDIT-158 role")
	seedAdminPermission(t, db, permissionID, permissionCode)
	if _, err := db.Exec(context.Background(), `INSERT INTO authz.admin_role_permission (role_id, permission_id) VALUES ($1,$2)`, roleID, permissionID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO authz.admin_actor_role (actor_id, role_id) VALUES ($1,$2)`, actorID, roleID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO ops.admin_audit_log (action,actor_id,target_type,target_id,reason) VALUES ('admin.iam.role.assigned',$1,'authz.admin_actor_role',$2,'audit158 fixture')`, actorID, actorID); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		path, code string
		fields     []string
	}{
		{path: "/api/admin/iam/roles", code: roleCode, fields: []string{`"id":`, `"status":"active"`, `"permissionCount":1`, `"adminCount":1`, `"createdAt":`}},
		{path: "/api/admin/iam/permissions", code: permissionCode, fields: []string{`"group":"audit158.permission"`, `"roleCodes":["` + roleCode + `"]`, `"roleCount":1`, `"adminCount":1`, `"createdAt":`}},
		{path: "/api/admin/iam/roles/" + roleCode, code: permissionCode, fields: []string{`"permissions":[{"code":"` + permissionCode + `"`, `"admins":[{"id":"` + actorID + `"`}},
		{path: "/api/admin/iam/permissions/" + permissionCode, code: roleCode, fields: []string{`"roles":[{"id":"` + roleID + `"`, `"admins":[{"id":"` + actorID + `"`}},
		{path: "/api/admin/iam/role-audit", code: actorID, fields: []string{`"action":"admin.iam.role.assigned"`, `"actor":{"id":"` + actorID + `"`}},
	} {
		res := call(tc.path)
		if res.Code != http.StatusOK || !strings.Contains(res.Body.String(), `"`+tc.code+`"`) {
			t.Errorf("GET %s status=%d body=%s; expected persisted code %q", tc.path, res.Code, res.Body.String(), tc.code)
			continue
		}
		for _, field := range tc.fields {
			if !strings.Contains(res.Body.String(), field) {
				t.Errorf("GET %s body=%s; missing contract field %q", tc.path, res.Body.String(), field)
			}
		}
	}
}
