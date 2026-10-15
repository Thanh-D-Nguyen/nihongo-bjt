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

func TestAdminOperationsAudit161Contracts(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	ctx := context.Background()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit161-ops-%s@example.test", actorID[:8]), "AUDIT-161 Ops Admin")
	token := createAdminSession(t, sessions, actorID)
	deniedActorID := newUUID(t)
	seedAdminActor(t, db, deniedActorID, fmt.Sprintf("audit161-denied-%s@example.test", deniedActorID[:8]), "AUDIT-161 No Permission")
	deniedToken := createAdminSession(t, sessions, deniedActorID)
	deadLetterID := newUUID(t)
	var broadcastID string
	if _, err := db.Exec(ctx, `INSERT INTO ops.dead_letter_entry (id,source,queue_name,event_type,payload,error_code,error_message,status,retry_count,created_at) VALUES ($1,'audit161','audit161.queue','audit161.event','{"safe":true}','audit161.error','disposable fixture','open',0,now())`, deadLetterID); err != nil {
		t.Fatalf("seed dead letter: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE target_id=$1 OR actor_id=$2`, broadcastID, actorID)
		_, _ = db.Exec(ctx, `DELETE FROM ops.dead_letter_entry WHERE id=$1`, deadLetterID)
	})
	call := func(method, path, body string, authenticated, trustedOrigin bool) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		if authenticated {
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		}
		if method != http.MethodGet {
			req.Header.Set("Content-Type", "application/json")
			if trustedOrigin {
				req.Header.Set("Origin", "http://localhost:3000")
				req.Header.Set("X-CSRF-Token", "audit161-csrf")
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
		{http.MethodGet, "/api/admin/operations/bjt/dashboard", false},
		{http.MethodGet, "/api/admin/operations/broadcasts", false},
		{http.MethodPost, "/api/admin/operations/broadcasts", true},
		{http.MethodPatch, "/api/admin/operations/broadcasts/audience/estimate", false},
		{http.MethodGet, "/api/admin/operations/broadcasts/00000000-0000-4000-8000-000000000001", false},
		{http.MethodPatch, "/api/admin/operations/broadcasts/00000000-0000-4000-8000-000000000001", true},
		{http.MethodPatch, "/api/admin/operations/broadcasts/00000000-0000-4000-8000-000000000001/cancel", true},
		{http.MethodPatch, "/api/admin/operations/broadcasts/00000000-0000-4000-8000-000000000001/schedule", true},
		{http.MethodGet, "/api/admin/operations/dead-letter-queue", false},
	}
	for _, route := range routes {
		t.Run("RBAC "+route.method+" "+route.path, func(t *testing.T) {
			if got := call(route.method, route.path, `{}`, false, true).Code; got != http.StatusUnauthorized {
				t.Fatalf("anonymous status=%d; want 401", got)
			}
			deniedReq := httptest.NewRequest(route.method, route.path, strings.NewReader(`{}`))
			deniedReq.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: deniedToken})
			if route.method != http.MethodGet {
				deniedReq.Header.Set("Origin", "http://localhost:3000")
				deniedReq.Header.Set("X-CSRF-Token", "audit161-csrf")
			}
			deniedRes := httptest.NewRecorder()
			srv.Config.Handler.ServeHTTP(deniedRes, deniedReq)
			if deniedRes.Code != http.StatusForbidden {
				t.Fatalf("admin without permission status=%d body=%s; want 403", deniedRes.Code, deniedRes.Body.String())
			}
			if route.write {
				grantAdminPermission(t, db, actorID, "iam.manage")
			} else {
				grantAdminPermission(t, db, actorID, "admin.content.read")
			}
			if route.method != http.MethodGet {
				if got := call(route.method, route.path, `{}`, true, false).Code; got != http.StatusForbidden {
					t.Fatalf("missing CSRF status=%d; want 403", got)
				}
			}
		})
	}
	grantAdminPermission(t, db, actorID, "admin.content.read")
	grantAdminPermission(t, db, actorID, "iam.manage")

	t.Run("BJT dashboard contract", func(t *testing.T) {
		res := call(http.MethodGet, "/api/admin/operations/bjt/dashboard", "", true, true)
		if res.Code != http.StatusOK {
			t.Fatalf("dashboard status=%d body=%s", res.Code, res.Body.String())
		}
		var payload struct {
			GeneratedAt string `json:"generatedAt"`
			ByLevel     []any  `json:"byLevel"`
		}
		if err := json.Unmarshal(res.Body.Bytes(), &payload); err != nil || payload.GeneratedAt == "" || payload.ByLevel == nil {
			t.Fatalf("dashboard contract=%s err=%v", res.Body.String(), err)
		}
	})

	t.Run("broadcast lifecycle persists and audits", func(t *testing.T) {
		invalid := call(http.MethodPost, "/api/admin/operations/broadcasts", `{"title":"AUDIT-161","body":"disposable","channel":"sms","reason":"invalid channel"}`, true, true)
		if invalid.Code != http.StatusBadRequest {
			t.Fatalf("invalid channel status=%d body=%s; want 400", invalid.Code, invalid.Body.String())
		}
		created := call(http.MethodPost, "/api/admin/operations/broadcasts", `{"title":"AUDIT-161","body":"disposable","channel":"in_app","audience":{"locale":["vi"]},"reason":"AUDIT-161 create"}`, true, true)
		if created.Code != http.StatusOK {
			t.Fatalf("create status=%d body=%s", created.Code, created.Body.String())
		}
		var result struct {
			ID     string `json:"id"`
			Status string `json:"status"`
		}
		if err := json.Unmarshal(created.Body.Bytes(), &result); err != nil || result.ID == "" || result.Status != "draft" {
			t.Fatalf("create response=%s err=%v", created.Body.String(), err)
		}
		broadcastID = result.ID
		patch := call(http.MethodPatch, "/api/admin/operations/broadcasts/"+broadcastID, `{"title":"AUDIT-161 updated","reason":"AUDIT-161 update"}`, true, true)
		if patch.Code != http.StatusOK {
			t.Fatalf("update status=%d body=%s", patch.Code, patch.Body.String())
		}
		for _, step := range []struct{ name, body string }{
			{"schedule", `{"reason":"AUDIT-161 schedule"}`},
			{"cancel", `{"reason":"AUDIT-161 cancel"}`},
		} {
			res := call(http.MethodPatch, "/api/admin/operations/broadcasts/"+broadcastID+"/"+step.name, step.body, true, true)
			if res.Code != http.StatusOK {
				t.Fatalf("%s status=%d body=%s", step.name, res.Code, res.Body.String())
			}
		}
		detail := call(http.MethodGet, "/api/admin/operations/broadcasts/"+broadcastID, "", true, true)
		if detail.Code != http.StatusOK || !strings.Contains(detail.Body.String(), `"status":"cancelled"`) || !strings.Contains(detail.Body.String(), `"title":"AUDIT-161 updated"`) {
			t.Fatalf("detail status=%d body=%s", detail.Code, detail.Body.String())
		}
		list := call(http.MethodGet, "/api/admin/operations/broadcasts?status=cancelled&channel=in_app", "", true, true)
		if list.Code != http.StatusOK || !strings.Contains(list.Body.String(), broadcastID) {
			t.Fatalf("list status=%d body=%s", list.Code, list.Body.String())
		}
		var audits int
		if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.admin_audit_log WHERE target_id=$1 AND actor_id=$2`, broadcastID, actorID).Scan(&audits); err != nil || audits != 4 {
			t.Fatalf("broadcast audit count=%d err=%v; want create/update/schedule/cancel", audits, err)
		}
	})

	t.Run("audience estimate and dead letter list contracts", func(t *testing.T) {
		estimate := call(http.MethodPatch, "/api/admin/operations/broadcasts/audience/estimate", `{"locale":["vi"]}`, true, true)
		if estimate.Code != http.StatusOK || !strings.Contains(estimate.Body.String(), `"source":"userProfile_locale_filter"`) {
			t.Fatalf("estimate status=%d body=%s", estimate.Code, estimate.Body.String())
		}
		estimate = call(http.MethodPatch, "/api/admin/operations/broadcasts/audience/estimate", `{"userIds":["one","two"]}`, true, true)
		if estimate.Code != http.StatusOK || !strings.Contains(estimate.Body.String(), `"estimatedRecipients":2`) {
			t.Fatalf("explicit estimate status=%d body=%s", estimate.Code, estimate.Body.String())
		}
		list := call(http.MethodGet, "/api/admin/operations/dead-letter-queue?queueName=audit161", "", true, true)
		if list.Code != http.StatusOK || !strings.Contains(list.Body.String(), deadLetterID) {
			t.Fatalf("dead-letter list status=%d body=%s", list.Code, list.Body.String())
		}
	})
}

func TestAdminOperationsAudit161QueryErrorsAreReturned(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit161-query-%s@example.test", actorID[:8]), "AUDIT-161 Query Admin")
	grantAdminPermission(t, db, actorID, "admin.content.read")
	token := createAdminSession(t, sessions, actorID)
	cases := []struct{ table, temporary, route string }{
		{"assessment.bjt_mock_test", "assessment.bjt_mock_test_audit161", "/api/admin/operations/bjt/dashboard"},
		{"ops.admin_audit_log", "ops.admin_audit_log_audit161", "/api/admin/operations/broadcasts"},
		{"ops.dead_letter_entry", "ops.dead_letter_entry_audit161", "/api/admin/operations/dead-letter-queue"},
	}
	for _, tc := range cases {
		t.Run(tc.route, func(t *testing.T) {
			if _, err := db.Exec(context.Background(), "ALTER TABLE "+tc.table+" RENAME TO "+strings.TrimPrefix(tc.temporary, strings.Split(tc.temporary, ".")[0]+".")); err != nil {
				t.Fatalf("make query unavailable: %v", err)
			}
			restore := func() {
				if _, err := db.Exec(context.Background(), "ALTER TABLE "+tc.temporary+" RENAME TO "+strings.TrimPrefix(tc.table, strings.Split(tc.table, ".")[0]+".")); err != nil {
					t.Fatalf("restore query table: %v", err)
				}
			}
			req := httptest.NewRequest(http.MethodGet, tc.route, nil)
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
			res := httptest.NewRecorder()
			srv.Config.Handler.ServeHTTP(res, req)
			restore()
			if res.Code != http.StatusInternalServerError {
				t.Fatalf("query failure status=%d body=%s; want 500", res.Code, res.Body.String())
			}
		})
	}
}
