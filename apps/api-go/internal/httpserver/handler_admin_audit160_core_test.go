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

func TestAdminMonetizationCoreContractsAUDIT160(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	ctx := context.Background()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit160-core-%s@example.com", actorID[:8]), "AUDIT-160 Core Admin")
	token := createAdminSession(t, sessions, actorID)
	var planID string
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE actor_id=$1 AND target_type='monetization.plan'`, actorID)
		if planID != "" {
			_, _ = db.Exec(ctx, `DELETE FROM monetization.plan WHERE id=$1`, planID)
		}
	})
	call := func(method, path, body string, authenticated bool) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		if authenticated {
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		}
		if method != http.MethodGet {
			req.Header.Set("Origin", "http://localhost:3000")
			req.Header.Set("X-CSRF-Token", "test-csrf")
			req.Header.Set("Content-Type", "application/json")
		}
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}

	routes := []struct{ method, path string }{
		{http.MethodGet, "/api/admin/monetization/analytics"},
		{http.MethodGet, "/api/admin/monetization/audit"},
		{http.MethodGet, "/api/admin/monetization/overview"},
		{http.MethodGet, "/api/admin/monetization/plans"},
		{http.MethodPost, "/api/admin/monetization/plans"},
		{http.MethodPatch, "/api/admin/monetization/plans/" + newUUID(t)},
	}
	for _, route := range routes {
		t.Run("requires admin session "+route.method+" "+route.path, func(t *testing.T) {
			if res := call(route.method, route.path, `{}`, false); res.Code != http.StatusUnauthorized {
				t.Fatalf("anonymous status=%d body=%s; want 401", res.Code, res.Body.String())
			}
		})
	}
	for _, route := range routes {
		t.Run("requires monetization permission "+route.method+" "+route.path, func(t *testing.T) {
			if res := call(route.method, route.path, `{}`, true); res.Code != http.StatusForbidden {
				t.Fatalf("roleless admin status=%d body=%s; want 403", res.Code, res.Body.String())
			}
		})
	}
	grantAdminPermission(t, db, actorID, "admin.monetization.read")
	grantAdminPermission(t, db, actorID, "admin.monetization.write")
	for _, route := range routes[4:] {
		t.Run("mutation requires CSRF "+route.method, func(t *testing.T) {
			req := httptest.NewRequest(route.method, route.path, strings.NewReader(`{}`))
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
			req.Header.Set("Content-Type", "application/json")
			res := httptest.NewRecorder()
			srv.Config.Handler.ServeHTTP(res, req)
			if res.Code != http.StatusForbidden {
				t.Fatalf("missing CSRF status=%d body=%s; want 403", res.Code, res.Body.String())
			}
		})
	}

	t.Run("audit rejects malformed date filters", func(t *testing.T) {
		res := call(http.MethodGet, "/api/admin/monetization/audit?from=not-a-date", "", true)
		if res.Code != http.StatusBadRequest {
			t.Fatalf("malformed date status=%d body=%s; want 400", res.Code, res.Body.String())
		}
	})

	t.Run("create rejects status beyond the database contract", func(t *testing.T) {
		res := call(http.MethodPost, "/api/admin/monetization/plans", `{"slug":"audit160-invalid","nameKey":"audit160.invalid","status":"123456789012345678901234567890123"}`, true)
		if res.Code != http.StatusBadRequest {
			t.Fatalf("overlong status=%d body=%s; want 400", res.Code, res.Body.String())
		}
		var count int
		if err := db.QueryRow(ctx, `SELECT count(*) FROM monetization.plan WHERE slug='audit160-invalid'`).Scan(&count); err != nil || count != 0 {
			t.Fatalf("invalid plan persisted count=%d err=%v", count, err)
		}
	})

	t.Run("patch malformed plan id is a client error", func(t *testing.T) {
		res := call(http.MethodPatch, "/api/admin/monetization/plans/not-a-uuid", `{"nameKey":"changed"}`, true)
		if res.Code != http.StatusBadRequest {
			t.Fatalf("malformed id status=%d body=%s; want 400", res.Code, res.Body.String())
		}
	})

	t.Run("plan routes persist, audit, and return their contracts", func(t *testing.T) {
		slug := "audit160-" + strings.ReplaceAll(actorID, "-", "")[:16]
		created := call(http.MethodPost, "/api/admin/monetization/plans", fmt.Sprintf(`{"slug":%q,"nameKey":"audit160.plan","status":"draft","config":{"source":"audit160"}}`, slug), true)
		if created.Code != http.StatusCreated {
			t.Fatalf("create status=%d body=%s", created.Code, created.Body.String())
		}
		var createdBody struct {
			ID     string `json:"id"`
			Slug   string `json:"slug"`
			Status string `json:"status"`
		}
		if err := json.Unmarshal(created.Body.Bytes(), &createdBody); err != nil || createdBody.ID == "" || createdBody.Slug != slug || createdBody.Status != "draft" {
			t.Fatalf("create body=%+v err=%v raw=%s", createdBody, err, created.Body.String())
		}
		planID = createdBody.ID
		duplicate := call(http.MethodPost, "/api/admin/monetization/plans", fmt.Sprintf(`{"slug":%q,"nameKey":"audit160.duplicate"}`, slug), true)
		if duplicate.Code != http.StatusConflict {
			t.Fatalf("duplicate slug status=%d body=%s; want 409", duplicate.Code, duplicate.Body.String())
		}

		patched := call(http.MethodPatch, "/api/admin/monetization/plans/"+planID, `{"nameKey":"audit160.updated","status":"active","sortOrder":17}`, true)
		if patched.Code != http.StatusOK {
			t.Fatalf("patch status=%d body=%s", patched.Code, patched.Body.String())
		}
		var nameKey, status string
		var sortOrder int
		if err := db.QueryRow(ctx, `SELECT name_key,status,sort_order FROM monetization.plan WHERE id=$1`, planID).Scan(&nameKey, &status, &sortOrder); err != nil || nameKey != "audit160.updated" || status != "active" || sortOrder != 17 {
			t.Fatalf("persisted plan nameKey=%q status=%q sortOrder=%d err=%v", nameKey, status, sortOrder, err)
		}
		var audits int
		if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND target_id=$2 AND target_type='monetization.plan' AND action IN ('admin.monetization.plan.created','admin.monetization.plan.updated')`, actorID, planID).Scan(&audits); err != nil || audits != 2 {
			t.Fatalf("plan audit count=%d err=%v", audits, err)
		}

		for _, endpoint := range []struct {
			path string
			key  string
		}{
			{"/api/admin/monetization/analytics", "eventsByName"},
			{"/api/admin/monetization/overview", "kpis"},
		} {
			res := call(http.MethodGet, endpoint.path, "", true)
			var body map[string]json.RawMessage
			if res.Code != http.StatusOK || json.Unmarshal(res.Body.Bytes(), &body) != nil || len(body[endpoint.key]) == 0 {
				t.Fatalf("%s status=%d body=%s", endpoint.path, res.Code, res.Body.String())
			}
		}
		list := call(http.MethodGet, "/api/admin/monetization/plans", "", true)
		var plans []struct {
			ID           string            `json:"id"`
			Entitlements []json.RawMessage `json:"entitlements"`
			PlanQuotas   []json.RawMessage `json:"planQuotas"`
		}
		if list.Code != http.StatusOK || json.Unmarshal(list.Body.Bytes(), &plans) != nil {
			t.Fatalf("plans status=%d body=%s", list.Code, list.Body.String())
		}
		found := false
		for _, plan := range plans {
			if plan.ID == planID {
				found = true
				if plan.Entitlements == nil || plan.PlanQuotas == nil {
					t.Fatalf("plan child collections must be arrays: %+v", plan)
				}
			}
		}
		if !found {
			t.Fatalf("plan listing omitted %s: %s", planID, list.Body.String())
		}
		audit := call(http.MethodGet, "/api/admin/monetization/audit?action=admin.monetization.plan&take=200", "", true)
		var auditBody struct {
			Items []json.RawMessage `json:"items"`
		}
		if audit.Code != http.StatusOK || json.Unmarshal(audit.Body.Bytes(), &auditBody) != nil || len(auditBody.Items) < 2 {
			t.Fatalf("audit status=%d itemCount=%d body=%s", audit.Code, len(auditBody.Items), audit.Body.String())
		}
	})
}
