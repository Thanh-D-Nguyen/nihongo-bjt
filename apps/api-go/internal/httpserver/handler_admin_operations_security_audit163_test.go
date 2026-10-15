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

func TestAdminOperationsSecurityAudit163Routes(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	ctx := context.Background()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit163-%s@example.test", actorID[:8]), "AUDIT-163 Admin")
	token := createAdminSession(t, sessions, actorID)
	deniedID := newUUID(t)
	seedAdminActor(t, db, deniedID, fmt.Sprintf("audit163-denied-%s@example.test", deniedID[:8]), "AUDIT-163 Denied")
	deniedToken := createAdminSession(t, sessions, deniedID)
	action := "audit163.login.failed"
	var eventID string
	if err := db.QueryRow(ctx, `INSERT INTO ops.admin_audit_log (actor_id,action,target_type,target_id,after,created_at)
		VALUES ($1,$2,'audit163.fixture',$3,'{"severity":"high"}',now()) RETURNING id`, actorID, action, actorID).Scan(&eventID); err != nil {
		t.Fatalf("seed security event: %v", err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO ops.admin_audit_log (actor_id,action,target_type,target_id,after,created_at)
		VALUES ($1,'audit163.suspicious.request','audit163.fixture',$2,'{"severity":"low"}',now())`, actorID, actorID); err != nil {
		t.Fatalf("seed second security event: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE actor_id IN ($1,$2) AND action LIKE 'audit163.%'`, actorID, deniedID)
		_, _ = db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE target_type='ops.security_event' AND target_id=$1`, eventID)
	})
	call := func(method, path, body, session string, csrf bool) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		if session != "" {
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: session})
		}
		if method != http.MethodGet {
			req.Header.Set("Content-Type", "application/json")
			if csrf {
				req.Header.Set("Origin", "http://localhost:3000")
				req.Header.Set("X-CSRF-Token", "audit163-csrf")
			}
		}
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}
	routes := []struct {
		method, path      string
		withoutPermission int
	}{
		{http.MethodGet, "/api/admin/operations/security", http.StatusForbidden},
		{http.MethodGet, "/api/admin/operations/security/events", http.StatusForbidden},
		{http.MethodGet, "/api/admin/operations/security/events/" + eventID, http.StatusForbidden},
		{http.MethodPatch, "/api/admin/operations/security/events/" + eventID + "/resolve", http.StatusForbidden},
		{http.MethodGet, "/api/admin/permissions", http.StatusForbidden},
	}
	for _, route := range routes {
		t.Run("auth "+route.method+" "+route.path, func(t *testing.T) {
			if got := call(route.method, route.path, `{"resolution":"resolved","reason":"AUDIT-163"}`, "", true).Code; got != http.StatusUnauthorized {
				t.Fatalf("anonymous status=%d; want 401", got)
			}
			if got := call(route.method, route.path, `{"resolution":"resolved","reason":"AUDIT-163"}`, deniedToken, true).Code; got != route.withoutPermission {
				t.Fatalf("admin without permission status=%d; want %d", got, route.withoutPermission)
			}
		})
	}
	grantAdminPermission(t, db, actorID, "iam.manage")
	t.Run("permission catalog contract", func(t *testing.T) {
		res := call(http.MethodGet, "/api/admin/permissions", "", token, true)
		var permissions []struct {
			ID   string `json:"id"`
			Code string `json:"code"`
		}
		if res.Code != http.StatusOK || json.Unmarshal(res.Body.Bytes(), &permissions) != nil || len(permissions) == 0 {
			t.Fatalf("permissions status=%d body=%s", res.Code, res.Body.String())
		}
		found := false
		for i, permission := range permissions {
			if permission.Code == "iam.manage" && permission.ID != "" {
				found = true
			}
			if i > 0 && permissions[i-1].Code > permission.Code {
				t.Fatalf("permissions are not ordered by code: %q before %q", permissions[i-1].Code, permission.Code)
			}
		}
		if !found {
			t.Fatalf("permission catalog omitted iam.manage: %s", res.Body.String())
		}
	})
	if got := call(http.MethodPatch, "/api/admin/operations/security/events/"+eventID+"/resolve", `{"resolution":"resolved","reason":"AUDIT-163"}`, token, false).Code; got != http.StatusForbidden {
		t.Fatalf("resolve without CSRF status=%d; want 403", got)
	}

	t.Run("overview and filtered events contract", func(t *testing.T) {
		res := call(http.MethodGet, "/api/admin/operations/security", "", token, true)
		if res.Code != http.StatusOK {
			t.Fatalf("overview status=%d body=%s", res.Code, res.Body.String())
		}
		var overview struct {
			Total      int            `json:"total"`
			BySeverity map[string]int `json:"bySeverity"`
			ByType     map[string]int `json:"byType"`
		}
		if err := json.Unmarshal(res.Body.Bytes(), &overview); err != nil || overview.Total < 2 || overview.BySeverity["high"] < 1 || overview.ByType["failed_login"] < 1 {
			t.Fatalf("overview contract=%s err=%v", res.Body.String(), err)
		}
		res = call(http.MethodGet, "/api/admin/operations/security/events?type=failed_login&severity=high&actorId="+actorID+"&from=2026-10-15&to=2026-10-15&limit=50&offset=0", "", token, true)
		if res.Code != http.StatusOK {
			t.Fatalf("filtered list status=%d body=%s", res.Code, res.Body.String())
		}
		var list struct {
			Items []struct {
				ID    string `json:"id"`
				Type  string `json:"type"`
				Actor struct {
					ID          string `json:"id"`
					DisplayName string `json:"displayName"`
				} `json:"actor"`
				Resolution json.RawMessage `json:"resolution"`
			} `json:"items"`
			Total int `json:"total"`
		}
		if err := json.Unmarshal(res.Body.Bytes(), &list); err != nil || list.Total != 1 || len(list.Items) != 1 || list.Items[0].ID != eventID || list.Items[0].Type != "failed_login" || list.Items[0].Actor.ID != actorID || list.Items[0].Actor.DisplayName != "AUDIT-163 Admin" {
			t.Fatalf("filtered list contract=%s err=%v", res.Body.String(), err)
		}
	})

	t.Run("resolve persists audit and detail returns UI contract", func(t *testing.T) {
		for _, id := range []string{"not-a-uuid"} {
			path := "/api/admin/operations/security/events/" + id
			if got := call(http.MethodGet, path, "", token, true).Code; got != http.StatusBadRequest {
				t.Errorf("GET invalid id %q status=%d; want 400", id, got)
			}
			path = "/api/admin/operations/security/events/" + id + "/resolve"
			if got := call(http.MethodPatch, path, `{"resolution":"resolved","reason":"AUDIT-163"}`, token, true).Code; got != http.StatusBadRequest {
				t.Errorf("PATCH invalid id %q status=%d; want 400", id, got)
			}
		}
		resolved := call(http.MethodPatch, "/api/admin/operations/security/events/"+eventID+"/resolve", `{"resolution":"false_positive","reason":"AUDIT-163 verified"}`, token, true)
		if resolved.Code != http.StatusOK {
			t.Fatalf("resolve status=%d body=%s", resolved.Code, resolved.Body.String())
		}
		var auditCount int
		if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND target_id=$2 AND target_type='ops.security_event' AND action='ops.security.false_positive' AND reason='AUDIT-163 verified'`, actorID, eventID).Scan(&auditCount); err != nil || auditCount != 1 {
			t.Fatalf("resolution audit count=%d err=%v", auditCount, err)
		}
		detail := call(http.MethodGet, "/api/admin/operations/security/events/"+eventID, "", token, true)
		if detail.Code != http.StatusOK || !strings.Contains(detail.Body.String(), `"type":"failed_login"`) || !strings.Contains(detail.Body.String(), `"resolutions":[`) || !strings.Contains(detail.Body.String(), `"state":"false_positive"`) {
			t.Fatalf("detail status=%d body=%s; expected Admin detail/resolution contract", detail.Code, detail.Body.String())
		}
	})

	t.Run("database query failures return 500", func(t *testing.T) {
		for _, tc := range []struct{ table, temp, path, method string }{
			{"ops.admin_audit_log", "ops.admin_audit_log_audit163", "/api/admin/operations/security", http.MethodGet},
			{"ops.admin_audit_log", "ops.admin_audit_log_audit163", "/api/admin/operations/security/events", http.MethodGet},
			{"ops.admin_audit_log", "ops.admin_audit_log_audit163", "/api/admin/operations/security/events/" + eventID, http.MethodGet},
			{"ops.admin_audit_log", "ops.admin_audit_log_audit163", "/api/admin/operations/security/events/" + eventID + "/resolve", http.MethodPatch},
			{"authz.admin_permission", "authz.admin_permission_audit163", "/api/admin/permissions", http.MethodGet},
		} {
			if _, err := db.Exec(ctx, "ALTER TABLE "+tc.table+" RENAME TO "+strings.TrimPrefix(tc.temp, strings.Split(tc.temp, ".")[0]+".")); err != nil {
				t.Fatalf("rename %s: %v", tc.table, err)
			}
			res := call(tc.method, tc.path, `{"resolution":"resolved","reason":"AUDIT-163"}`, token, true)
			if _, err := db.Exec(ctx, "ALTER TABLE "+tc.temp+" RENAME TO "+strings.TrimPrefix(tc.table, strings.Split(tc.table, ".")[0]+".")); err != nil {
				t.Fatalf("restore %s: %v", tc.table, err)
			}
			if res.Code != http.StatusInternalServerError {
				t.Errorf("query failure %s %s status=%d body=%s; want 500", tc.method, tc.path, res.Code, res.Body.String())
			}
		}
	})
}
