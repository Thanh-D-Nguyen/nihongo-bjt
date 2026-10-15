package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestAdminPrivacyRequestsAudit159Routes(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	ctx := context.Background()
	actorID, deniedID, readerID := newUUID(t), newUUID(t), newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("privacy-%s@example.test", actorID[:8]), "Privacy Admin")
	seedAdminActor(t, db, deniedID, fmt.Sprintf("privacy-denied-%s@example.test", deniedID[:8]), "Privacy Denied")
	seedAdminActor(t, db, readerID, fmt.Sprintf("privacy-reader-%s@example.test", readerID[:8]), "Privacy Reader")
	grantAdminPermission(t, db, actorID, "privacy.manage")
	grantAdminPermission(t, db, readerID, "admin.content.read")
	token, deniedToken, readerToken := createAdminSession(t, sessions, actorID), createAdminSession(t, sessions, deniedID), createAdminSession(t, sessions, readerID)
	ids := []string{newUUID(t), newUUID(t), newUUID(t), newUUID(t)}
	userIDs := []string{newUUID(t), newUUID(t), newUUID(t), newUUID(t)}
	for i, kind := range []string{"export", "delete", "export", "export"} {
		if _, err := db.Exec(ctx, `INSERT INTO profile.user_profile (id,email,display_name,status,updated_at) VALUES ($1,$2,'Disposable Privacy User','active',now())`, userIDs[i], fmt.Sprintf("privacy-user-%s@example.test", userIDs[i][:8])); err != nil {
			t.Fatalf("seed disposable privacy user: %v", err)
		}
		if _, err := db.Exec(ctx, `INSERT INTO profile.privacy_request (id,user_id,kind,status) VALUES ($1,$2,$3,'pending')`, ids[i], userIDs[i], kind); err != nil {
			t.Fatalf("seed disposable privacy request: %v", err)
		}
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM profile.privacy_request WHERE id = ANY($1::uuid[])`, ids)
		_, _ = db.Exec(ctx, `DELETE FROM profile.user_profile WHERE id = ANY($1::uuid[])`, userIDs)
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
				req.Header.Set("X-CSRF-Token", "audit159-csrf")
			}
		}
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}
	routes := []struct {
		method, path string
		write        bool
	}{
		{http.MethodGet, "/api/admin/privacy/requests", false},
		{http.MethodGet, "/api/admin/privacy/requests/" + ids[0], false},
		{http.MethodPatch, "/api/admin/privacy/requests/" + ids[0] + "/acknowledge", true},
		{http.MethodPost, "/api/admin/privacy/requests/" + ids[1] + "/erasure-confirm", true},
		{http.MethodPost, "/api/admin/privacy/requests/" + ids[2] + "/fulfill", true},
		{http.MethodPost, "/api/admin/privacy/requests/" + ids[3] + "/reject", true},
	}
	for _, route := range routes {
		t.Run(route.method+" "+route.path, func(t *testing.T) {
			if got := call(route.method, route.path, `{}`, "", true).Code; got != http.StatusUnauthorized {
				t.Errorf("anonymous=%d want 401", got)
			}
			if got := call(route.method, route.path, `{}`, deniedToken, true).Code; got != http.StatusForbidden {
				t.Errorf("admin without privacy permission=%d want 403", got)
			}
			readerWant := http.StatusOK
			if route.write {
				readerWant = http.StatusForbidden
			}
			if got := call(route.method, route.path, `{"reason":"AUDIT-159 test","confirmationToken":"`+ids[1]+`"}`, readerToken, true).Code; got != readerWant {
				t.Errorf("read-only content Admin=%d want %d", got, readerWant)
			}
			if route.write {
				if got := call(route.method, route.path, `{"reason":"AUDIT-159 test","confirmationToken":"`+ids[1]+`"}`, token, false).Code; got != http.StatusForbidden {
					t.Errorf("missing CSRF=%d want 403", got)
				}
				if got := call(route.method, route.path, `{}`, token, true).Code; got != http.StatusBadRequest {
					t.Errorf("invalid mutation body=%d want 400", got)
				}
			}
		})
	}
	if res := call(http.MethodGet, "/api/admin/privacy/requests?kind=delete&status=pending&limit=20&offset=0", "", token, true); res.Code != http.StatusOK || !strings.Contains(res.Body.String(), ids[1]) {
		t.Fatalf("filtered list status=%d body=%s", res.Code, res.Body.String())
	}
	if res := call(http.MethodGet, "/api/admin/privacy/requests/not-a-uuid", "", token, true); res.Code != http.StatusBadRequest {
		t.Errorf("invalid detail id=%d want 400", res.Code)
	}
	if res := call(http.MethodGet, "/api/admin/privacy/requests/"+newUUID(t), "", token, true); res.Code != http.StatusNotFound {
		t.Errorf("missing detail=%d want 404", res.Code)
	}
	if res := call(http.MethodGet, "/api/admin/privacy/requests?kind=unknown", "", token, true); res.Code != http.StatusBadRequest {
		t.Errorf("invalid list filter=%d want 400", res.Code)
	}
	if res := call(http.MethodGet, "/api/admin/privacy/requests/"+ids[0], "", token, true); res.Code != http.StatusOK || !strings.Contains(res.Body.String(), `"audit":[`) {
		t.Fatalf("detail status=%d body=%s", res.Code, res.Body.String())
	}
	if res := call(http.MethodPost, "/api/admin/privacy/requests/"+ids[2]+"/erasure-confirm", `{"reason":"AUDIT-159 invalid token","confirmationToken":"wrong"}`, token, true); res.Code != http.StatusBadRequest {
		t.Errorf("erasure token validation=%d want 400", res.Code)
	}
	if res := call(http.MethodPost, "/api/admin/privacy/requests/"+ids[0]+"/erasure-confirm", `{"reason":"AUDIT-159 wrong kind","confirmationToken":"`+ids[0]+`"}`, token, true); res.Code != http.StatusBadRequest {
		t.Errorf("erasure kind validation=%d want 400", res.Code)
	}
	if res := call(http.MethodPost, "/api/admin/privacy/requests/"+ids[1]+"/fulfill", `{"reason":"AUDIT-159 wrong kind"}`, token, true); res.Code != http.StatusBadRequest {
		t.Errorf("fulfill kind validation=%d want 400", res.Code)
	}
	if res := call(http.MethodPatch, "/api/admin/privacy/requests/"+ids[0]+"/acknowledge", `{"reason":"AUDIT-159 acknowledged"}`, token, true); res.Code != http.StatusOK {
		t.Fatalf("ack status=%d body=%s", res.Code, res.Body.String())
	}
	if res := call(http.MethodPost, "/api/admin/privacy/requests/"+ids[1]+"/erasure-confirm", `{"reason":"AUDIT-159 confirmed","confirmationToken":"`+ids[1]+`"}`, token, true); res.Code != http.StatusOK {
		t.Fatalf("erasure status=%d body=%s", res.Code, res.Body.String())
	}
	if res := call(http.MethodPost, "/api/admin/privacy/requests/"+ids[2]+"/fulfill", `{"reason":"AUDIT-159 fulfilled","downloadUrl":"https://example.test/export","notes":"fixture"}`, token, true); res.Code != http.StatusOK {
		t.Fatalf("fulfill status=%d body=%s", res.Code, res.Body.String())
	}
	if res := call(http.MethodPost, "/api/admin/privacy/requests/"+ids[3]+"/reject", `{"reason":"AUDIT-159 rejected"}`, token, true); res.Code != http.StatusOK {
		t.Fatalf("reject status=%d body=%s", res.Code, res.Body.String())
	}
	for i, want := range []string{"processing", "completed", "completed", "failed"} {
		var status string
		var completedAt *time.Time
		if err := db.QueryRow(ctx, `SELECT status,completed_at FROM profile.privacy_request WHERE id=$1`, ids[i]).Scan(&status, &completedAt); err != nil || status != want {
			t.Errorf("request %s status=%q err=%v want=%q", ids[i], status, err, want)
		}
		var audits int
		wantAudits := 1
		if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.admin_audit_log WHERE target_id=$1 AND target_type='privacy.request' AND actor_id=$2`, ids[i], actorID).Scan(&audits); err != nil || audits != wantAudits {
			t.Errorf("request %s audit count=%d err=%v want=%d", ids[i], audits, err, wantAudits)
		}
	}
	var payload *json.RawMessage
	if err := db.QueryRow(ctx, `SELECT result_payload FROM profile.privacy_request WHERE id=$1`, ids[2]).Scan(&payload); err != nil || payload == nil || !strings.Contains(string(*payload), `"artifact"`) {
		t.Errorf("fulfilled export payload=%v err=%v", payload, err)
	}
}
