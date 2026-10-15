package httpserver

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"
)

func TestAdminLegalCookieCategoriesRequiresIManage(t *testing.T) {
	pool := testPool(t)
	srv, sessions := adminRBACTestServer(t)
	defer srv.Close()

	request := func(token string) *http.Response {
		t.Helper()
		req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/admin/legal/cookie-categories", nil)
		if err != nil {
			t.Fatal(err)
		}
		if token != "" {
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		}
		resp, err := srv.Client().Do(req)
		if err != nil {
			t.Fatalf("GET cookie categories: %v", err)
		}
		return resp
	}

	anonymous := request("")
	anonymous.Body.Close()
	if anonymous.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected anonymous request to return 401, got %d", anonymous.StatusCode)
	}

	rolelessID := newUUID(t)
	seedAdminActor(t, pool, rolelessID, fmt.Sprintf("cookie-roleless-%s@example.test", rolelessID[:8]), "Cookie Roleless")
	rolelessToken := createAdminSession(t, sessions, rolelessID)
	roleless := request(rolelessToken)
	roleless.Body.Close()
	if roleless.StatusCode != http.StatusForbidden {
		t.Fatalf("expected roleless Admin to return 403, got %d", roleless.StatusCode)
	}

	actorID := newUUID(t)
	seedAdminActor(t, pool, actorID, fmt.Sprintf("cookie-reader-%s@example.test", actorID[:8]), "Cookie Reader")
	grantAdminPermission(t, pool, actorID, "admin.legal.read")
	resp := request(createAdminSession(t, sessions, actorID))
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected admin.legal.read Admin to return 200, got %d", resp.StatusCode)
	}
	var body struct {
		Items []struct {
			Key           string   `json:"key"`
			Name          string   `json:"name"`
			Description   string   `json:"description"`
			OptInDefault  *bool    `json:"optInDefault"`
			CanOptOut     *bool    `json:"canOptOut"`
			DataCollected []string `json:"dataCollected"`
			RetentionDays int      `json:"retentionDays"`
			ThirdParties  []string `json:"thirdParties"`
		} `json:"items"`
		Total                int    `json:"total"`
		PartialSchemaPending bool   `json:"partialSchemaPending"`
		Note                 string `json:"note"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode cookie categories: %v", err)
	}
	wantKeys := map[string]bool{"essential": true, "functional": true, "analytics": true, "marketing": true}
	if len(body.Items) != len(wantKeys) || body.Total != len(wantKeys) || !body.PartialSchemaPending || body.Note == "" {
		t.Fatalf("unexpected cookie categories envelope: %+v", body)
	}
	for _, item := range body.Items {
		if !wantKeys[item.Key] || item.Name == "" || item.Description == "" || item.OptInDefault == nil || item.CanOptOut == nil || item.DataCollected == nil || len(item.DataCollected) == 0 || item.RetentionDays <= 0 || item.ThirdParties == nil {
			t.Fatalf("invalid cookie category item: %+v", item)
		}
		delete(wantKeys, item.Key)
	}
	if len(wantKeys) != 0 || strings.TrimSpace(body.Note) == "" {
		t.Fatalf("missing expected cookie category keys: %v", wantKeys)
	}

	iamActorID := newUUID(t)
	seedAdminActor(t, pool, iamActorID, fmt.Sprintf("cookie-iam-%s@example.test", iamActorID[:8]), "Cookie IAM Admin")
	grantIAMManage(t, pool, iamActorID)
	iamResp := request(createAdminSession(t, sessions, iamActorID))
	defer iamResp.Body.Close()
	if iamResp.StatusCode != http.StatusOK {
		t.Fatalf("expected iam.manage Admin to return 200, got %d", iamResp.StatusCode)
	}
}

func TestAdminLegalRetentionRequiresPermission(t *testing.T) {
	pool := testPool(t)
	srv, sessions := adminRBACTestServer(t)
	defer srv.Close()

	request := func(token string) *http.Response {
		t.Helper()
		req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/admin/legal/retention", nil)
		if err != nil {
			t.Fatal(err)
		}
		if token != "" {
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		}
		resp, err := srv.Client().Do(req)
		if err != nil {
			t.Fatalf("GET retention domains: %v", err)
		}
		return resp
	}

	anonymous := request("")
	anonymous.Body.Close()
	if anonymous.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected anonymous request to return 401, got %d", anonymous.StatusCode)
	}

	rolelessID := newUUID(t)
	seedAdminActor(t, pool, rolelessID, fmt.Sprintf("retention-roleless-%s@example.test", rolelessID[:8]), "Retention Roleless")
	roleless := request(createAdminSession(t, sessions, rolelessID))
	roleless.Body.Close()
	if roleless.StatusCode != http.StatusForbidden {
		t.Fatalf("expected roleless Admin to return 403, got %d", roleless.StatusCode)
	}

	readID := newUUID(t)
	seedAdminActor(t, pool, readID, fmt.Sprintf("retention-read-%s@example.test", readID[:8]), "Retention Reader")
	grantAdminPermission(t, pool, readID, "admin.legal.read")
	resp := request(createAdminSession(t, sessions, readID))
	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		t.Fatalf("expected admin.legal.read Admin to return 200, got %d", resp.StatusCode)
	}
	var body struct {
		Items []struct {
			Domain          string `json:"domain"`
			Label           string `json:"label"`
			Description     string `json:"description"`
			RetentionDays   *int   `json:"retentionDays"`
			GracePeriodDays *int   `json:"gracePeriodDays"`
			Runner          string `json:"runner"`
			Schedule        string `json:"schedule"`
			Irreversible    *bool  `json:"irreversible"`
		} `json:"items"`
		Total                int    `json:"total"`
		PartialSchemaPending bool   `json:"partialSchemaPending"`
		Note                 string `json:"note"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		resp.Body.Close()
		t.Fatalf("decode retention domains: %v", err)
	}
	resp.Body.Close()
	wantDomains := map[string]bool{"users": true, "battle.sessions": true, "messages": true, "auth.sessions": true, "logs.audit": true, "logs.events": true, "privacy.requests": true}
	if len(body.Items) != len(wantDomains) || body.Total != len(wantDomains) || !body.PartialSchemaPending || strings.TrimSpace(body.Note) == "" {
		t.Fatalf("unexpected retention envelope: %+v", body)
	}
	for _, item := range body.Items {
		if !wantDomains[item.Domain] || item.Label == "" || item.Description == "" || item.RetentionDays == nil || *item.RetentionDays <= 0 || item.GracePeriodDays == nil || item.Runner == "" || item.Schedule == "" || item.Irreversible == nil {
			t.Fatalf("invalid retention item: %+v", item)
		}
		delete(wantDomains, item.Domain)
	}
	if len(wantDomains) != 0 {
		t.Fatalf("missing retention domains: %v", wantDomains)
	}

	iamID := newUUID(t)
	seedAdminActor(t, pool, iamID, fmt.Sprintf("retention-iam-%s@example.test", iamID[:8]), "Retention IAM Admin")
	grantIAMManage(t, pool, iamID)
	iamResp := request(createAdminSession(t, sessions, iamID))
	defer iamResp.Body.Close()
	if iamResp.StatusCode != http.StatusOK {
		t.Fatalf("expected iam.manage Admin to return 200, got %d", iamResp.StatusCode)
	}
}
