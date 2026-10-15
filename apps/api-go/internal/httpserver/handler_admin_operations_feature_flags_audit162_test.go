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

func TestAdminOperationsFeatureFlagsAUDIT162(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	ctx := context.Background()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit162-flags-%s@example.test", actorID[:8]), "AUDIT-162 Flags Admin")
	deniedActorID := newUUID(t)
	seedAdminActor(t, db, deniedActorID, fmt.Sprintf("audit162-denied-%s@example.test", deniedActorID[:8]), "AUDIT-162 Denied Admin")
	token, deniedToken := createAdminSession(t, sessions, actorID), createAdminSession(t, sessions, deniedActorID)
	key := "security.audit162." + strings.ReplaceAll(actorID, "-", "")[:16]
	killKey := key + ".kill"
	if _, err := db.Exec(ctx, `INSERT INTO ops.feature_flag (key, enabled, kill_switch, description, scope, rules, created_at, updated_at) VALUES ($1,false,false,'AUDIT-162 fixture','audit162','{"rolloutPercent":10}',now(),now()), ($2,true,true,'AUDIT-162 kill fixture','audit162','{}',now(),now())`, key, killKey); err != nil {
		t.Fatalf("seed feature flags: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE actor_id=$1`, actorID)
		_, _ = db.Exec(ctx, `DELETE FROM ops.feature_flag WHERE key IN ($1,$2)`, key, killKey)
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
				req.Header.Set("X-CSRF-Token", "audit162-csrf")
			}
		}
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}
	routes := []struct {
		method string
		path   string
		write  bool
	}{
		{http.MethodGet, "/api/admin/operations/feature-flags", false},
		{http.MethodPatch, "/api/admin/operations/feature-flags/" + key, true},
		{http.MethodGet, "/api/admin/operations/feature-flags/" + key + "/history", false},
		{http.MethodGet, "/api/admin/operations/kill-switches", false},
	}
	for _, route := range routes {
		t.Run("auth "+route.method+" "+route.path, func(t *testing.T) {
			if got := call(route.method, route.path, `{}`, "", true).Code; got != http.StatusUnauthorized {
				t.Fatalf("anonymous status=%d; want 401", got)
			}
			if got := call(route.method, route.path, `{}`, deniedToken, true).Code; got != http.StatusForbidden {
				t.Fatalf("admin without iam.manage status=%d; want 403", got)
			}
			if route.write {
				grantAdminPermission(t, db, actorID, "iam.manage")
				if got := call(route.method, route.path, `{}`, token, false).Code; got != http.StatusForbidden {
					t.Fatalf("missing CSRF status=%d; want 403", got)
				}
			}
		})
	}
	grantAdminPermission(t, db, actorID, "iam.manage")

	t.Run("list contracts and kill switch filter", func(t *testing.T) {
		flags := call(http.MethodGet, "/api/admin/operations/feature-flags", "", token, true)
		if flags.Code != http.StatusOK {
			t.Fatalf("feature flags status=%d body=%s", flags.Code, flags.Body.String())
		}
		var list []map[string]json.RawMessage
		if err := json.Unmarshal(flags.Body.Bytes(), &list); err != nil {
			t.Fatalf("decode flags: %v body=%s", err, flags.Body.String())
		}
		if !containsFlagKey(list, key) || !containsFlagKey(list, killKey) {
			t.Fatalf("fixture flags missing from list: %s", flags.Body.String())
		}
		killSwitches := call(http.MethodGet, "/api/admin/operations/kill-switches", "", token, true)
		if killSwitches.Code != http.StatusOK {
			t.Fatalf("kill switches status=%d body=%s", killSwitches.Code, killSwitches.Body.String())
		}
		list = nil
		if err := json.Unmarshal(killSwitches.Body.Bytes(), &list); err != nil || !containsFlagKey(list, killKey) || containsFlagKey(list, key) {
			t.Fatalf("kill switch filter body=%s err=%v", killSwitches.Body.String(), err)
		}
	})

	t.Run("update persists audit and history", func(t *testing.T) {
		for _, tc := range []struct{ path, body string }{
			{"/api/admin/operations/feature-flags/not-a-real-flag", `{"enabled":true,"reason":"audit162 missing"}`},
			{"/api/admin/operations/feature-flags/", `{"enabled":true,"reason":"audit162 missing key"}`},
		} {
			if got := call(http.MethodPatch, tc.path, tc.body, token, true).Code; got != http.StatusNotFound {
				t.Errorf("missing flag path %q status=%d; want 404", tc.path, got)
			}
		}
		for _, body := range []string{"{", `{"reason":"audit162"}`, `{"enabled":true}`} {
			if got := call(http.MethodPatch, "/api/admin/operations/feature-flags/"+key, body, token, true).Code; got != http.StatusBadRequest {
				t.Errorf("invalid update body %q status=%d; want 400", body, got)
			}
		}
		unconfirmed := call(http.MethodPatch, "/api/admin/operations/feature-flags/"+key, `{"enabled":true,"rules":{"rolloutPercent":25},"reason":"AUDIT-162 update"}`, token, true)
		if unconfirmed.Code != http.StatusBadRequest || !strings.Contains(unconfirmed.Body.String(), `"code":"high_risk_confirmation_required"`) {
			t.Fatalf("high-risk update without confirmation status=%d body=%s", unconfirmed.Code, unconfirmed.Body.String())
		}
		updated := call(http.MethodPatch, "/api/admin/operations/feature-flags/"+key, fmt.Sprintf(`{"enabled":true,"rules":{"rolloutPercent":25},"reason":"AUDIT-162 update","confirmation":%q}`, key), token, true)
		if updated.Code != http.StatusOK {
			t.Fatalf("update status=%d body=%s", updated.Code, updated.Body.String())
		}
		var enabled bool
		var rules []byte
		if err := db.QueryRow(ctx, `SELECT enabled,rules FROM ops.feature_flag WHERE key=$1`, key).Scan(&enabled, &rules); err != nil || !enabled || !strings.Contains(string(rules), `"rolloutPercent": 25`) {
			t.Fatalf("persisted flag enabled=%t rules=%s err=%v", enabled, rules, err)
		}
		var auditCount int
		if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.feature_flag_audit WHERE flag_key=$1 AND actor_id=$2 AND reason='AUDIT-162 update'`, key, actorID).Scan(&auditCount); err != nil || auditCount != 1 {
			t.Fatalf("feature flag audit count=%d err=%v", auditCount, err)
		}
		if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.admin_audit_log WHERE target_id=$1 AND actor_id=$2 AND action='ops.feature_flag.update'`, key, actorID).Scan(&auditCount); err != nil || auditCount != 1 {
			t.Fatalf("admin audit count=%d err=%v", auditCount, err)
		}
		if _, err := db.Exec(ctx, `INSERT INTO ops.feature_flag_audit (flag_key,action,actor_id,before,after,reason,created_at) VALUES ($1,'legacy',NULL,NULL,NULL,NULL,now())`, key); err != nil {
			t.Fatalf("seed nullable legacy audit: %v", err)
		}
		history := call(http.MethodGet, "/api/admin/operations/feature-flags/"+key+"/history?limit=50", "", token, true)
		if history.Code != http.StatusOK || !strings.Contains(history.Body.String(), `"flag":{"key":"`+key+`"`) || !strings.Contains(history.Body.String(), `"displayName":"AUDIT-162 Flags Admin"`) || !strings.Contains(history.Body.String(), `"reason":"AUDIT-162 update"`) || !strings.Contains(history.Body.String(), `"enabled":true`) {
			t.Fatalf("history status=%d body=%s", history.Code, history.Body.String())
		}
		if got := call(http.MethodGet, "/api/admin/operations/feature-flags/not-a-real-flag/history", "", token, true).Code; got != http.StatusNotFound {
			t.Fatalf("missing history flag status=%d; want 404", got)
		}
	})

	t.Run("database query failures are returned", func(t *testing.T) {
		for _, tc := range []struct{ table, temp, route string }{
			{"ops.feature_flag", "ops.feature_flag_audit162", "/api/admin/operations/feature-flags"},
			{"ops.feature_flag_audit", "ops.feature_flag_audit162_history", "/api/admin/operations/feature-flags/" + key + "/history"},
			{"ops.feature_flag", "ops.feature_flag_audit162_kill", "/api/admin/operations/kill-switches"},
		} {
			if _, err := db.Exec(ctx, "ALTER TABLE "+tc.table+" RENAME TO "+strings.TrimPrefix(tc.temp, "ops.")); err != nil {
				t.Fatalf("rename %s to trigger query failure: %v", tc.table, err)
			}
			res := call(http.MethodGet, tc.route, "", token, true)
			if _, err := db.Exec(ctx, "ALTER TABLE "+tc.temp+" RENAME TO "+strings.TrimPrefix(tc.table, "ops.")); err != nil {
				t.Fatalf("restore %s: %v", tc.table, err)
			}
			if res.Code != http.StatusInternalServerError {
				t.Errorf("query failure %s status=%d body=%s; want 500", tc.route, res.Code, res.Body.String())
			}
		}
	})
}

func containsFlagKey(items []map[string]json.RawMessage, key string) bool {
	for _, item := range items {
		var got string
		if json.Unmarshal(item["key"], &got) == nil && got == key {
			return true
		}
	}
	return false
}
