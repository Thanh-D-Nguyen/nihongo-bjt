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

func TestAdminMonetizationAdsAUDIT160Routes(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit160-ads-%s@example.com", actorID[:8]), "AUDIT-160 Ads Admin")
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	token := createAdminSession(t, sessions, actorID)
	placementID, providerID := newUUID(t), "audit160-"+strings.ReplaceAll(actorID, "-", "")[:16]
	ruleKey := "audit160-" + strings.ReplaceAll(actorID, "-", "")[:16]
	if _, err := db.Exec(ctx, `INSERT INTO monetization.ad_placement (id,code,label_key,active,config,created_at,updated_at) VALUES ($1,$2,$3,true,'{}',now(),now())`, placementID, ruleKey, "ads.test"); err != nil {
		t.Fatalf("seed placement: %v", err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO monetization.ad_provider_config (key,type,enabled,status,config,created_at,updated_at) VALUES ($1,'local',true,'ok','{}',now(),now())`, providerID); err != nil {
		t.Fatalf("seed provider: %v", err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO monetization.ad_safety_rule (rule_key,enabled,config,updated_at) VALUES ($1,true,$2,now())`, ruleKey, `{"ruleType":"frequency","condition":"dailyLimit","action":"block","priority":2}`); err != nil {
		t.Fatalf("seed rule: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE actor_id=$1`, actorID)
		_, _ = db.Exec(ctx, `DELETE FROM monetization.ad_safety_rule WHERE rule_key=$1`, ruleKey)
		_, _ = db.Exec(ctx, `DELETE FROM monetization.ad_provider_config WHERE key=$1`, providerID)
		_, _ = db.Exec(ctx, `DELETE FROM monetization.ad_placement WHERE id=$1`, placementID)
	})
	call := func(method, path, body, requestToken string, trustedOrigin bool) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		if requestToken != "" {
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: requestToken})
		}
		if method != http.MethodGet {
			if trustedOrigin {
				req.Header.Set("Origin", "http://localhost:3000")
			}
			req.Header.Set("Content-Type", "application/json")
		}
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}
	routes := []struct {
		method, path, permission string
	}{
		{http.MethodPatch, "/api/admin/monetization/ads/placements/" + placementID, "admin.monetization.write"},
		{http.MethodGet, "/api/admin/monetization/ads/providers", "admin.monetization.read"},
		{http.MethodPatch, "/api/admin/monetization/ads/providers/" + providerID, "admin.monetization.write"},
		{http.MethodGet, "/api/admin/monetization/ads/rules", "admin.monetization.read"},
		{http.MethodPost, "/api/admin/monetization/ads/rules", "admin.monetization.write"},
	}
	for _, route := range routes {
		t.Run("auth "+route.method+" "+route.path, func(t *testing.T) {
			if got := call(route.method, route.path, `{}`, "", true).Code; got != http.StatusUnauthorized {
				t.Fatalf("anonymous status=%d; want 401", got)
			}
			if got := call(route.method, route.path, `{}`, token, true).Code; got != http.StatusForbidden {
				t.Fatalf("unprivileged admin status=%d; want 403", got)
			}
			if route.method != http.MethodGet {
				grantAdminPermission(t, db, actorID, route.permission)
				if got := call(route.method, route.path, `{}`, token, false).Code; got != http.StatusForbidden {
					t.Fatalf("missing trusted origin status=%d; want 403", got)
				}
			}
		})
	}
	grantAdminPermission(t, db, actorID, "admin.monetization.read")
	grantAdminPermission(t, db, actorID, "admin.monetization.write")

	t.Run("placement patch persists and audits", func(t *testing.T) {
		res := call(http.MethodPatch, "/api/admin/monetization/ads/placements/"+placementID, `{"active":false,"labelKey":"ads.updated","config":{"slot":"footer"}}`, token, true)
		if res.Code != http.StatusOK {
			t.Fatalf("patch status=%d body=%s", res.Code, res.Body.String())
		}
		var response map[string]any
		if err := json.Unmarshal(res.Body.Bytes(), &response); err != nil || response["id"] != placementID || response["updated"] != true {
			t.Fatalf("patch response=%s err=%v", res.Body.String(), err)
		}
		var active bool
		var label string
		var config []byte
		if err := db.QueryRow(ctx, `SELECT active,label_key,config FROM monetization.ad_placement WHERE id=$1`, placementID).Scan(&active, &label, &config); err != nil {
			t.Fatalf("read patched placement: %v", err)
		}
		if active || label != "ads.updated" || !strings.Contains(string(config), `"footer"`) {
			t.Fatalf("placement persistence active=%t label=%q config=%s", active, label, config)
		}
		assertAdminAuditEvent(t, db, actorID, "admin.ads.placement.updated", "monetization.ad_placement", placementID)
		if got := call(http.MethodPatch, "/api/admin/monetization/ads/placements/"+newUUID(t), `{"active":true}`, token, true).Code; got != http.StatusNotFound {
			t.Fatalf("missing placement status=%d; want 404", got)
		}
		if got := call(http.MethodPatch, "/api/admin/monetization/ads/placements/not-a-uuid", `{"active":true}`, token, true).Code; got != http.StatusBadRequest {
			t.Fatalf("invalid placement id status=%d; want 400", got)
		}
		for _, body := range []string{"{", `{}`, `{"config":[]}`} {
			if got := call(http.MethodPatch, "/api/admin/monetization/ads/placements/"+placementID, body, token, true).Code; got != http.StatusBadRequest {
				t.Errorf("invalid placement body %q status=%d; want 400", body, got)
			}
		}
	})

	t.Run("provider list and patch contract", func(t *testing.T) {
		res := call(http.MethodGet, "/api/admin/monetization/ads/providers", "", token, true)
		if res.Code != http.StatusOK {
			t.Fatalf("list status=%d body=%s", res.Code, res.Body.String())
		}
		var providers []map[string]json.RawMessage
		if err := json.Unmarshal(res.Body.Bytes(), &providers); err != nil {
			t.Fatalf("decode providers: %v", err)
		}
		found := false
		for _, item := range providers {
			var key, typ string
			_ = json.Unmarshal(item["key"], &key)
			_ = json.Unmarshal(item["type"], &typ)
			if key == providerID {
				found = true
				if typ != "local" {
					t.Errorf("provider type=%q; want local", typ)
				}
				for _, field := range []string{"id", "status", "config", "createdAt", "updatedAt"} {
					if _, ok := item[field]; !ok {
						t.Errorf("provider response missing %q: %s", field, res.Body.String())
					}
				}
			}
		}
		if !found {
			t.Fatalf("provider %q missing from response: %s", providerID, res.Body.String())
		}
		patch := call(http.MethodPatch, "/api/admin/monetization/ads/providers/"+providerID, `{"enabled":false,"status":"warning","config":{"region":"jp"},"lastSyncAt":null}`, token, true)
		if patch.Code != http.StatusOK {
			t.Fatalf("patch status=%d body=%s", patch.Code, patch.Body.String())
		}
		var enabled bool
		var status string
		var config []byte
		var lastSyncAt *string
		if err := db.QueryRow(ctx, `SELECT enabled,status,config,last_sync_at::text FROM monetization.ad_provider_config WHERE key=$1`, providerID).Scan(&enabled, &status, &config, &lastSyncAt); err != nil {
			t.Fatalf("read patched provider: %v", err)
		}
		if enabled || status != "warning" || !strings.Contains(string(config), `"region"`) || lastSyncAt != nil {
			t.Fatalf("provider persistence enabled=%t status=%q config=%s lastSyncAt=%v", enabled, status, config, lastSyncAt)
		}
		assertAdminAuditEvent(t, db, actorID, "admin.ads.provider.updated", "monetization.ad_provider_config", providerID)
		if got := call(http.MethodPatch, "/api/admin/monetization/ads/providers/missing-"+providerID, `{"enabled":false}`, token, true).Code; got != http.StatusNotFound {
			t.Fatalf("missing provider status=%d; want 404", got)
		}
		for _, body := range []string{"{", `{}`, `{"config":[]}`, `{"status":"unknown"}`, `{"lastSyncAt":"yesterday"}`} {
			if got := call(http.MethodPatch, "/api/admin/monetization/ads/providers/"+providerID, body, token, true).Code; got != http.StatusBadRequest {
				t.Errorf("invalid provider body %q status=%d; want 400", body, got)
			}
		}
	})

	t.Run("rules list and create contract", func(t *testing.T) {
		list := call(http.MethodGet, "/api/admin/monetization/ads/rules", "", token, true)
		if list.Code != http.StatusOK {
			t.Fatalf("list status=%d body=%s", list.Code, list.Body.String())
		}
		var rules []map[string]json.RawMessage
		if err := json.Unmarshal(list.Body.Bytes(), &rules); err != nil {
			t.Fatalf("decode rules: %v", err)
		}
		found := false
		for _, item := range rules {
			var name, typ string
			_ = json.Unmarshal(item["name"], &name)
			_ = json.Unmarshal(item["ruleType"], &typ)
			if name == ruleKey {
				found = true
				if typ != "frequency" {
					t.Errorf("rule type=%q; want frequency", typ)
				}
				for _, field := range []string{"condition", "action", "priority", "active", "updatedAt"} {
					if _, ok := item[field]; !ok {
						t.Errorf("rule response missing %q: %s", field, list.Body.String())
					}
				}
			}
		}
		if !found {
			t.Fatalf("rule %q missing from response: %s", ruleKey, list.Body.String())
		}
		body := fmt.Sprintf(`{"name":%q,"ruleType":"frequency","condition":"weeklyLimit","action":"block","priority":3}`, ruleKey+"-created")
		created := call(http.MethodPost, "/api/admin/monetization/ads/rules", body, token, true)
		if created.Code != http.StatusCreated {
			t.Fatalf("create status=%d body=%s", created.Code, created.Body.String())
		}
		var response struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		}
		if err := json.Unmarshal(created.Body.Bytes(), &response); err != nil || response.ID == "" || response.Name != ruleKey+"-created" {
			t.Fatalf("create response=%s err=%v", created.Body.String(), err)
		}
		t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM monetization.ad_safety_rule WHERE id=$1`, response.ID) })
		var storedConfig []byte
		if err := db.QueryRow(ctx, `SELECT config FROM monetization.ad_safety_rule WHERE id=$1`, response.ID).Scan(&storedConfig); err != nil {
			t.Fatalf("read created rule: %v", err)
		}
		var configFields map[string]any
		if err := json.Unmarshal(storedConfig, &configFields); err != nil {
			t.Fatalf("decode created rule config: %v", err)
		}
		if configFields["condition"] != "weeklyLimit" || configFields["priority"] != float64(3) {
			t.Fatalf("rule config persistence=%s", storedConfig)
		}
		assertAdminAuditEvent(t, db, actorID, "admin.ads.rule.created", "monetization.ad_safety_rule", response.ID)
		for _, invalid := range []string{"{", `{}`, `{"name":"   "}`, `{"name":"incomplete"}`} {
			if got := call(http.MethodPost, "/api/admin/monetization/ads/rules", invalid, token, true).Code; got != http.StatusBadRequest {
				t.Errorf("invalid rule body %q status=%d; want 400", invalid, got)
			}
		}
	})
}
