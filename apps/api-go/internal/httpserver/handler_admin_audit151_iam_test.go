package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAudit151IAMAdminDetailAndMutationsPersistWithAudit(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	ctx := context.Background()
	actorID, targetID := newUUID(t), newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit151-iam-actor-%s@example.com", actorID[:8]), "AUDIT-151 IAM actor")
	seedAdminActor(t, db, targetID, fmt.Sprintf("audit151-iam-target-%s@example.com", targetID[:8]), "AUDIT-151 target")
	grantAdminPermission(t, db, actorID, "iam.manage")
	token := createAdminSession(t, sessions, actorID)
	var roleCode string
	if err := db.QueryRow(ctx, `SELECT code FROM authz.admin_role ORDER BY code LIMIT 1`).Scan(&roleCode); err != nil {
		t.Fatal(err)
	}
	call := func(method, path, body string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		req.Header.Set("Origin", "http://localhost:3000")
		req.Header.Set("X-CSRF-Token", "test-csrf")
		if body != "" {
			req.Header.Set("Content-Type", "application/json")
		}
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}
	detail := call(http.MethodGet, "/api/admin/iam/admins/"+targetID, "")
	var initial struct {
		ID     string   `json:"id"`
		Status string   `json:"status"`
		Roles  []string `json:"roles"`
	}
	if detail.Code != http.StatusOK || json.Unmarshal(detail.Body.Bytes(), &initial) != nil || initial.ID != targetID || initial.Status != "active" {
		t.Fatalf("IAM detail status=%d body=%s", detail.Code, detail.Body.String())
	}
	assigned := call(http.MethodPost, "/api/admin/iam/admins/"+targetID+"/roles", fmt.Sprintf(`{"roleCode":%q,"reason":"audit151 assign"}`, roleCode))
	if assigned.Code != http.StatusOK || !strings.Contains(assigned.Body.String(), `"assigned":true`) {
		t.Fatalf("assign role status=%d body=%s", assigned.Code, assigned.Body.String())
	}
	updated := call(http.MethodPatch, "/api/admin/iam/admins/"+targetID, `{"status":"disabled","reason":"audit151 disable"}`)
	if updated.Code != http.StatusOK {
		t.Fatalf("patch admin status=%d body=%s", updated.Code, updated.Body.String())
	}
	if err := db.QueryRow(ctx, `SELECT status FROM authz.admin_actor WHERE id=$1`, targetID).Scan(&initial.Status); err != nil || initial.Status != "disabled" {
		t.Fatalf("stored admin status=%q err=%v", initial.Status, err)
	}
	roleDetail := call(http.MethodGet, "/api/admin/iam/admins/"+targetID, "")
	if roleDetail.Code != http.StatusOK || !strings.Contains(roleDetail.Body.String(), `"`+roleCode+`"`) {
		t.Fatalf("detail after assignment status=%d body=%s", roleDetail.Code, roleDetail.Body.String())
	}
	revoked := call(http.MethodDelete, "/api/admin/iam/admins/"+targetID+"/roles/"+roleCode, `{"reason":"audit151 revoke"}`)
	if revoked.Code != http.StatusOK || !strings.Contains(revoked.Body.String(), `"revoked":true`) {
		t.Fatalf("revoke role status=%d body=%s", revoked.Code, revoked.Body.String())
	}
	var assignments, audits int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM authz.admin_actor_role aar JOIN authz.admin_role ar ON ar.id=aar.role_id WHERE aar.actor_id=$1 AND ar.code=$2`, targetID, roleCode).Scan(&assignments); err != nil || assignments != 0 {
		t.Fatalf("role assignments=%d err=%v after revoke", assignments, err)
	}
	if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND target_id=$2 AND action IN ('admin.iam.role.assigned','admin.iam.role.revoked','admin.iam.admin.updated')`, actorID, targetID).Scan(&audits); err != nil || audits != 3 {
		t.Fatalf("IAM audit rows=%d err=%v, want 3", audits, err)
	}
}
