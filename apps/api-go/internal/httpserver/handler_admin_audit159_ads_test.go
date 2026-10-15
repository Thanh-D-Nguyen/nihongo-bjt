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

func TestAdminMonetizationAdsContractsAUDIT159(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	ctx := context.Background()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit159-ads-%s@example.com", actorID[:8]), "AUDIT-159 Ads Admin")
	token := createAdminSession(t, sessions, actorID)

	var placementID, campaignID string
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE actor_id=$1`, actorID)
		if campaignID != "" {
			_, _ = db.Exec(ctx, `DELETE FROM monetization.ad_campaign WHERE id=$1`, campaignID)
		}
		if placementID != "" {
			_, _ = db.Exec(ctx, `DELETE FROM monetization.ad_placement WHERE id=$1`, placementID)
		}
	})
	call := func(method, path, body string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		if token != "" {
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
	decode := func(t *testing.T, res *httptest.ResponseRecorder, out any) {
		t.Helper()
		if err := json.Unmarshal(res.Body.Bytes(), out); err != nil {
			t.Fatalf("decode response (%d): %v; body=%s", res.Code, err, res.Body.String())
		}
	}

	paths := []struct{ method, path string }{
		{http.MethodGet, "/api/admin/monetization/ads/audit"},
		{http.MethodGet, "/api/admin/monetization/ads/campaigns"},
		{http.MethodPost, "/api/admin/monetization/ads/campaigns"},
		{http.MethodPatch, "/api/admin/monetization/ads/campaigns/" + newUUID(t)},
		{http.MethodGet, "/api/admin/monetization/ads/overview"},
		{http.MethodGet, "/api/admin/monetization/ads/performance"},
		{http.MethodGet, "/api/admin/monetization/ads/placements"},
		{http.MethodPost, "/api/admin/monetization/ads/placements"},
	}
	for _, route := range paths {
		t.Run("admin authorization "+route.method+" "+route.path, func(t *testing.T) {
			oldToken := token
			token = ""
			defer func() { token = oldToken }()
			res := call(route.method, route.path, `{}`)
			if res.Code != http.StatusUnauthorized {
				t.Fatalf("anonymous status=%d body=%s; want 401", res.Code, res.Body.String())
			}
		})
	}
	for _, route := range paths {
		t.Run("permission authorization "+route.method+" "+route.path, func(t *testing.T) {
			res := call(route.method, route.path, `{}`)
			if res.Code != http.StatusForbidden {
				t.Fatalf("roleless admin status=%d body=%s; want 403", res.Code, res.Body.String())
			}
		})
	}
	grantAdminPermission(t, db, actorID, "admin.monetization.read")
	grantAdminPermission(t, db, actorID, "admin.monetization.write")

	placementCode := "audit159-" + strings.ReplaceAll(actorID, "-", "")[:16]
	placementRes := call(http.MethodPost, "/api/admin/monetization/ads/placements", fmt.Sprintf(
		`{"code":%q,"name":"AUDIT-159 placement","active":true,"config":{"slot":"header"}}`, placementCode))
	if placementRes.Code != http.StatusCreated {
		t.Fatalf("create placement status=%d body=%s", placementRes.Code, placementRes.Body.String())
	}
	var createdPlacement struct {
		ID   string `json:"id"`
		Code string `json:"code"`
	}
	decode(t, placementRes, &createdPlacement)
	if createdPlacement.ID == "" || createdPlacement.Code != placementCode {
		t.Fatalf("create placement response=%+v", createdPlacement)
	}
	placementID = createdPlacement.ID

	var storedPlacement struct {
		Code   string          `json:"code"`
		Active bool            `json:"active"`
		Config json.RawMessage `json:"config"`
	}
	if err := db.QueryRow(ctx, `SELECT code, active, config FROM monetization.ad_placement WHERE id=$1`, placementID).
		Scan(&storedPlacement.Code, &storedPlacement.Active, &storedPlacement.Config); err != nil {
		t.Fatalf("read created placement: %v", err)
	}
	var placementConfig map[string]string
	if err := json.Unmarshal(storedPlacement.Config, &placementConfig); err != nil {
		t.Fatalf("decode placement config: %v", err)
	}
	if storedPlacement.Code != placementCode || !storedPlacement.Active || placementConfig["slot"] != "header" {
		t.Fatalf("placement persistence=%+v config=%s", storedPlacement, storedPlacement.Config)
	}

	placementsRes := call(http.MethodGet, "/api/admin/monetization/ads/placements", "")
	if placementsRes.Code != http.StatusOK {
		t.Fatalf("list placements status=%d body=%s", placementsRes.Code, placementsRes.Body.String())
	}
	var placements []map[string]json.RawMessage
	decode(t, placementsRes, &placements)
	foundPlacement := false
	for _, item := range placements {
		var code, id string
		_ = json.Unmarshal(item["code"], &code)
		_ = json.Unmarshal(item["id"], &id)
		if code == placementCode && id == placementID {
			for _, key := range []string{"active", "config", "createdAt", "updatedAt"} {
				if _, ok := item[key]; !ok {
					t.Errorf("placement response missing %q: %s", key, placementsRes.Body.String())
				}
			}
			foundPlacement = true
		}
	}
	if !foundPlacement {
		t.Fatalf("placements response omitted created row %q: %s", placementCode, placementsRes.Body.String())
	}

	campaignName := "AUDIT-159 campaign " + actorID
	campaignBody := fmt.Sprintf(`{"name":%q,"providerKey":"local","placementCodes":[%q],"status":"draft","priority":4,"creativeType":"native","policyStatus":"ok","startAt":"2030-01-02T00:00:00Z","endAt":"2030-01-03T00:00:00Z"}`, campaignName, placementCode)
	campaignRes := call(http.MethodPost, "/api/admin/monetization/ads/campaigns", campaignBody)
	if campaignRes.Code != http.StatusCreated {
		t.Fatalf("create campaign status=%d body=%s", campaignRes.Code, campaignRes.Body.String())
	}
	var createdCampaign struct {
		ID     string `json:"id"`
		Name   string `json:"name"`
		Status string `json:"status"`
	}
	decode(t, campaignRes, &createdCampaign)
	if createdCampaign.ID == "" || createdCampaign.Name != campaignName || createdCampaign.Status != "draft" {
		t.Fatalf("create campaign response=%+v", createdCampaign)
	}
	campaignID = createdCampaign.ID

	var dbName, dbStatus, dbProvider, dbPolicy string
	var dbCodes []byte
	var priority int
	if err := db.QueryRow(ctx, `SELECT name,status,provider_key,placement_codes,priority,policy_status FROM monetization.ad_campaign WHERE id=$1`, campaignID).
		Scan(&dbName, &dbStatus, &dbProvider, &dbCodes, &priority, &dbPolicy); err != nil {
		t.Fatalf("read created campaign: %v", err)
	}
	if dbName != campaignName || dbStatus != "draft" || dbProvider != "local" || string(dbCodes) != fmt.Sprintf(`["%s"]`, placementCode) || priority != 4 || dbPolicy != "ok" {
		t.Fatalf("campaign persistence name=%q status=%q provider=%q placements=%s priority=%d policy=%q", dbName, dbStatus, dbProvider, dbCodes, priority, dbPolicy)
	}

	patchRes := call(http.MethodPatch, "/api/admin/monetization/ads/campaigns/"+campaignID, `{"status":"paused","name":"AUDIT-159 campaign updated"}`)
	if patchRes.Code != http.StatusOK {
		t.Fatalf("patch campaign status=%d body=%s", patchRes.Code, patchRes.Body.String())
	}
	if err := db.QueryRow(ctx, `SELECT name,status FROM monetization.ad_campaign WHERE id=$1`, campaignID).Scan(&dbName, &dbStatus); err != nil {
		t.Fatalf("read patched campaign: %v", err)
	}
	if dbName != "AUDIT-159 campaign updated" || dbStatus != "paused" {
		t.Fatalf("campaign patch persistence name=%q status=%q", dbName, dbStatus)
	}

	campaignsRes := call(http.MethodGet, "/api/admin/monetization/ads/campaigns?page=1&pageSize=20", "")
	if campaignsRes.Code != http.StatusOK {
		t.Fatalf("list campaigns status=%d body=%s", campaignsRes.Code, campaignsRes.Body.String())
	}
	var campaigns struct {
		Items    []map[string]json.RawMessage `json:"items"`
		Page     int                          `json:"page"`
		PageSize int                          `json:"pageSize"`
		Total    int                          `json:"total"`
	}
	decode(t, campaignsRes, &campaigns)
	found := false
	for _, item := range campaigns.Items {
		var id, name, provider, status string
		_ = json.Unmarshal(item["id"], &id)
		_ = json.Unmarshal(item["name"], &name)
		_ = json.Unmarshal(item["providerKey"], &provider)
		_ = json.Unmarshal(item["status"], &status)
		if id == campaignID && name == dbName && provider == "local" && status == "paused" {
			found = true
		}
	}
	if !found || campaigns.Page != 1 || campaigns.PageSize != 20 || campaigns.Total < 1 {
		t.Fatalf("campaign list contract missing persisted row: %+v", campaigns)
	}

	if _, err := db.Exec(ctx, `INSERT INTO monetization.ad_impression (placement_id,campaign_id,kind,created_at) VALUES ($1,$2,'impression',now()),($1,$2,'click',now()),($1,$2,'blocked',now())`, placementID, campaignID); err != nil {
		t.Fatalf("seed performance events: %v", err)
	}
	for _, endpoint := range []string{"overview", "performance"} {
		res := call(http.MethodGet, "/api/admin/monetization/ads/"+endpoint+"?windowDays=7", "")
		if res.Code != http.StatusOK {
			t.Fatalf("%s status=%d body=%s", endpoint, res.Code, res.Body.String())
		}
		var body map[string]json.RawMessage
		decode(t, res, &body)
		if endpoint == "overview" {
			for _, key := range []string{"enabledPlacements", "activeCampaigns", "providersEnabled", "policyWarnings", "impressions7d", "clicks7d", "blocked7d", "ctr"} {
				if _, ok := body[key]; !ok {
					t.Errorf("overview missing %q: %s", key, res.Body.String())
				}
			}
			var impressions, clicks, blocked int
			_ = json.Unmarshal(body["impressions7d"], &impressions)
			_ = json.Unmarshal(body["clicks7d"], &clicks)
			_ = json.Unmarshal(body["blocked7d"], &blocked)
			if impressions < 1 || clicks < 1 || blocked < 1 {
				t.Errorf("overview totals impressions=%d clicks=%d blocked=%d", impressions, clicks, blocked)
			}
		} else {
			var totals map[string]json.RawMessage
			if err := json.Unmarshal(body["totals"], &totals); err != nil {
				t.Fatalf("performance totals: %v", err)
			}
			for _, key := range []string{"impressions", "clicks", "blocked", "ctr"} {
				if _, ok := totals[key]; !ok {
					t.Errorf("performance totals missing %q: %s", key, res.Body.String())
				}
			}
			var days, impressions, clicks, blocked int
			var ctr float64
			_ = json.Unmarshal(body["windowDays"], &days)
			_ = json.Unmarshal(totals["impressions"], &impressions)
			_ = json.Unmarshal(totals["clicks"], &clicks)
			_ = json.Unmarshal(totals["blocked"], &blocked)
			_ = json.Unmarshal(totals["ctr"], &ctr)
			if days != 7 || impressions < 1 || clicks < 1 || blocked < 1 || ctr <= 0 {
				t.Errorf("performance values days=%d impressions=%d clicks=%d blocked=%d ctr=%v", days, impressions, clicks, blocked, ctr)
			}
		}
	}

	for _, invalid := range []struct{ method, path, body string }{
		{http.MethodPost, "/api/admin/monetization/ads/placements", `{}`},
		{http.MethodPost, "/api/admin/monetization/ads/placements", `{"code":"bad-json`},
		{http.MethodPost, "/api/admin/monetization/ads/campaigns", `{}`},
		{http.MethodPost, "/api/admin/monetization/ads/campaigns", `{"name":"bad-json`},
		{http.MethodPost, "/api/admin/monetization/ads/campaigns", `{"name":"bad date","providerKey":"local","startAt":"yesterday"}`},
		{http.MethodPost, "/api/admin/monetization/ads/campaigns", `{"name":"bad policy","providerKey":"local","policyStatus":"approved"}`},
		{http.MethodPatch, "/api/admin/monetization/ads/campaigns/" + campaignID, `{"policyStatus":"approved"}`},
		{http.MethodPatch, "/api/admin/monetization/ads/campaigns/" + campaignID, `{}`},
		{http.MethodPatch, "/api/admin/monetization/ads/campaigns/not-a-uuid", `{"status":"paused"}`},
	} {
		res := call(invalid.method, invalid.path, invalid.body)
		if res.Code != http.StatusBadRequest {
			t.Errorf("invalid %s %s status=%d body=%s; want 400", invalid.method, invalid.path, res.Code, res.Body.String())
		}
	}
	invalidEnd := call(http.MethodPatch, "/api/admin/monetization/ads/campaigns/"+campaignID, `{"endAt":"2030-01-01T00:00:00Z"}`)
	if invalidEnd.Code != http.StatusBadRequest {
		t.Fatalf("endAt before persisted startAt status=%d body=%s; want 400", invalidEnd.Code, invalidEnd.Body.String())
	}
	var persistedEnd time.Time
	if err := db.QueryRow(ctx, `SELECT end_at FROM monetization.ad_campaign WHERE id=$1`, campaignID).Scan(&persistedEnd); err != nil || !persistedEnd.Equal(time.Date(2030, 1, 3, 0, 0, 0, 0, time.UTC)) {
		t.Fatalf("invalid date patch changed persisted endAt=%v err=%v", persistedEnd, err)
	}
	missingRes := call(http.MethodPatch, "/api/admin/monetization/ads/campaigns/"+newUUID(t), `{"status":"paused"}`)
	if missingRes.Code != http.StatusNotFound {
		t.Errorf("missing campaign patch status=%d body=%s; want 404", missingRes.Code, missingRes.Body.String())
	}

	var audited int
	if err := db.QueryRow(ctx, `SELECT COUNT(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND target_id IN ($2,$3) AND action IN ('admin.ads.placement.created','admin.ads.campaign.created','admin.ads.campaign.updated')`, actorID, placementID, campaignID).Scan(&audited); err != nil {
		t.Fatalf("count Ads audit events: %v", err)
	}
	if audited != 3 {
		t.Fatalf("persisted Ads audit events=%d; want create placement, create campaign, and patch campaign", audited)
	}
	auditRes := call(http.MethodGet, "/api/admin/monetization/ads/audit?take=20", "")
	if auditRes.Code != http.StatusOK {
		t.Fatalf("audit status=%d body=%s", auditRes.Code, auditRes.Body.String())
	}
	var auditBody struct {
		Items []map[string]json.RawMessage `json:"items"`
	}
	decode(t, auditRes, &auditBody)
	seenAudit := map[string]bool{}
	for _, item := range auditBody.Items {
		var action, target string
		_ = json.Unmarshal(item["action"], &action)
		_ = json.Unmarshal(item["targetId"], &target)
		if _, hasID := item["id"]; hasID && item["at"] != nil && target != "" {
			seenAudit[action+":"+target] = true
		}
	}
	for _, expected := range []string{
		"admin.ads.placement.created:" + placementID,
		"admin.ads.campaign.created:" + campaignID,
		"admin.ads.campaign.updated:" + campaignID,
	} {
		if !seenAudit[expected] {
			t.Errorf("audit response omitted %q: %s", expected, auditRes.Body.String())
		}
	}
}

func TestAudit159AdsCampaignPatchClearsNullableFields(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit159-clear-%s@example.com", actorID[:8]), "AUDIT-159 Ads Clear")
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	token := createAdminSession(t, sessions, actorID)
	grantAdminPermission(t, db, actorID, "admin.monetization.write")
	campaignID := newUUID(t)
	if _, err := db.Exec(ctx, `INSERT INTO monetization.ad_campaign (id,name,provider_key,start_at,end_at,destination_url,target_locale,target_plan_slug,max_impressions,created_at,updated_at)
		VALUES ($1,'AUDIT-159 clear nullable fields','local','2030-01-02T00:00:00Z','2030-01-03T00:00:00Z','https://example.test/ad','vi','starter',100,NOW(),NOW())`, campaignID); err != nil {
		t.Fatalf("seed campaign: %v", err)
	}
	t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM monetization.ad_campaign WHERE id=$1`, campaignID) })
	req := httptest.NewRequest(http.MethodPatch, "/api/admin/monetization/ads/campaigns/"+campaignID,
		strings.NewReader(`{"startAt":null,"endAt":null,"destinationUrl":null,"targetLocale":null,"targetPlanSlug":null,"maxImpressions":null}`))
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.Header.Set("Content-Type", "application/json")
	res := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("clear nullable campaign fields status=%d body=%s", res.Code, res.Body.String())
	}
	var cleared bool
	if err := db.QueryRow(ctx, `SELECT start_at IS NULL AND end_at IS NULL AND destination_url IS NULL AND target_locale IS NULL AND target_plan_slug IS NULL AND max_impressions IS NULL FROM monetization.ad_campaign WHERE id=$1`, campaignID).Scan(&cleared); err != nil || !cleared {
		t.Fatalf("nullable campaign fields were not cleared: cleared=%t err=%v", cleared, err)
	}
	var audited int
	if err := db.QueryRow(ctx, `SELECT COUNT(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND target_id=$2 AND action='admin.ads.campaign.updated'`, actorID, campaignID).Scan(&audited); err != nil || audited != 1 {
		t.Fatalf("campaign clear audit count=%d err=%v; want 1", audited, err)
	}
}
