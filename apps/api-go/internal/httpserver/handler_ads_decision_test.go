package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"testing"
)

func TestAdsDecisionReturnsRenderableCampaign(t *testing.T) {
	db := testPool(t)
	srv, _ := adminRBACTestServer(t)
	defer srv.Close()

	placementCode := "audit-decision-" + newUUID(t)
	providerKey := "audit-" + newUUID(t)
	var placementID, campaignID string
	if err := db.QueryRow(context.Background(), `INSERT INTO monetization.ad_placement (code, active, config, updated_at)
		VALUES ($1, TRUE, '{}'::jsonb, NOW()) RETURNING id`, placementCode).Scan(&placementID); err != nil {
		t.Fatalf("seed placement: %v", err)
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO monetization.ad_provider_config (key, type, enabled, updated_at)
		VALUES ($1, 'local', TRUE, NOW())`, providerKey); err != nil {
		t.Fatalf("seed provider: %v", err)
	}
	codes, _ := json.Marshal([]string{placementCode})
	if err := db.QueryRow(context.Background(), `INSERT INTO monetization.ad_campaign
		(name, status, provider_key, placement_codes, start_at, end_at, creative_type, destination_url, target_locale, policy_status, created_at, updated_at)
		VALUES ('Audit storefront', 'active', $1, $2, NOW()-INTERVAL '1 hour', NOW()+INTERVAL '1 hour',
		'storefront', 'https://example.test/store', 'vi', 'ok', NOW(), NOW()) RETURNING id`, providerKey, codes).Scan(&campaignID); err != nil {
		t.Fatalf("seed campaign: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM monetization.ad_campaign WHERE id=$1`, campaignID)
		_, _ = db.Exec(context.Background(), `DELETE FROM monetization.ad_provider_config WHERE key=$1`, providerKey)
		_, _ = db.Exec(context.Background(), `DELETE FROM monetization.ad_placement WHERE id=$1`, placementID)
	})

	resp := postAdsDecision(t, srv.URL, placementCode, "vi")
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	var got struct {
		Eligible      bool   `json:"eligible"`
		CampaignID    string `json:"campaignId"`
		DecisionKey   string `json:"decisionKey"`
		DecisionToken string `json:"decisionToken"`
		Payload       struct {
			Campaign struct {
				ID             string `json:"id"`
				Name           string `json:"name"`
				CreativeType   string `json:"creativeType"`
				DestinationURL string `json:"destinationUrl"`
			} `json:"campaign"`
			ProviderType string `json:"providerType"`
		} `json:"payload"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
		t.Fatalf("decode decision: %v", err)
	}
	if !got.Eligible || got.CampaignID != campaignID || got.DecisionKey == "" || got.DecisionToken == "" {
		t.Fatalf("decision = %+v; want eligible campaign and decision credentials", got)
	}
	if got.Payload.Campaign.ID != campaignID || got.Payload.Campaign.Name != "Audit storefront" || got.Payload.Campaign.CreativeType != "storefront" || got.Payload.Campaign.DestinationURL != "https://example.test/store" || got.Payload.ProviderType != "local" {
		t.Fatalf("campaign payload = %+v; want canonical campaign fields", got.Payload)
	}
}

func TestAdsDecisionReturnsNoCampaignContract(t *testing.T) {
	db := testPool(t)
	srv, _ := adminRBACTestServer(t)
	defer srv.Close()

	placementCode := "audit-empty-decision-" + newUUID(t)
	var placementID string
	if err := db.QueryRow(context.Background(), `INSERT INTO monetization.ad_placement (code, active, config, updated_at)
		VALUES ($1, TRUE, '{}'::jsonb, NOW()) RETURNING id`, placementCode).Scan(&placementID); err != nil {
		t.Fatalf("seed placement: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM monetization.ad_placement WHERE id=$1`, placementID)
	})

	resp := postAdsDecision(t, srv.URL, placementCode, "vi")
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	var got struct {
		Eligible    bool   `json:"eligible"`
		DecisionKey string `json:"decisionKey"`
		Payload     any    `json:"payload"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
		t.Fatalf("decode no-campaign decision: %v", err)
	}
	if got.Eligible || got.DecisionKey == "" || got.Payload != nil {
		t.Fatalf("decision = %+v; want ineligible, keyed decision without campaign payload", got)
	}
	if _, err := db.Exec(context.Background(), `UPDATE monetization.ad_placement SET active=FALSE WHERE id=$1`, placementID); err != nil {
		t.Fatalf("deactivate placement: %v", err)
	}
	resp2 := postAdsDecision(t, srv.URL, placementCode, "vi")
	defer resp2.Body.Close()
	if resp2.StatusCode != http.StatusNotFound {
		t.Fatalf("inactive placement status = %d, want 404", resp2.StatusCode)
	}
}

func TestAdsDecisionFiltersDraftRejectedAndWrongLocaleCampaigns(t *testing.T) {
	db := testPool(t)
	srv, _ := adminRBACTestServer(t)
	defer srv.Close()

	placementCode := "audit-filter-decision-" + newUUID(t)
	providerKey := "audit-" + newUUID(t)
	var placementID string
	if err := db.QueryRow(context.Background(), `INSERT INTO monetization.ad_placement (code, active, config, updated_at)
		VALUES ($1, TRUE, '{}'::jsonb, NOW()) RETURNING id`, placementCode).Scan(&placementID); err != nil {
		t.Fatalf("seed placement: %v", err)
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO monetization.ad_provider_config (key, type, enabled, updated_at)
		VALUES ($1, 'local', TRUE, NOW())`, providerKey); err != nil {
		t.Fatalf("seed provider: %v", err)
	}
	codes, _ := json.Marshal([]string{placementCode})
	for _, c := range []struct{ name, status, policy, locale string }{
		{"Draft", "draft", "ok", "vi"},
		{"Rejected", "active", "rejected", "vi"},
		{"Wrong locale", "active", "ok", "ja"},
	} {
		_, err := db.Exec(context.Background(), `INSERT INTO monetization.ad_campaign
			(name, status, provider_key, placement_codes, creative_type, destination_url, target_locale, policy_status, created_at, updated_at)
			VALUES ($1, $2, $3, $4, 'storefront', 'https://example.test/store', $5, $6, NOW(), NOW())`,
			"Audit "+c.name, c.status, providerKey, codes, c.locale, c.policy)
		if err != nil {
			t.Fatalf("seed %s campaign: %v", c.name, err)
		}
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM monetization.ad_campaign WHERE provider_key=$1`, providerKey)
		_, _ = db.Exec(context.Background(), `DELETE FROM monetization.ad_provider_config WHERE key=$1`, providerKey)
		_, _ = db.Exec(context.Background(), `DELETE FROM monetization.ad_placement WHERE id=$1`, placementID)
	})

	resp := postAdsDecision(t, srv.URL, placementCode, "vi")
	defer resp.Body.Close()
	var got struct {
		Eligible bool `json:"eligible"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
		t.Fatalf("decode filtered decision: %v", err)
	}
	if resp.StatusCode != http.StatusOK || got.Eligible {
		t.Fatalf("status=%d eligible=%v; want 200 and no eligible campaign", resp.StatusCode, got.Eligible)
	}
}

func postAdsDecision(t *testing.T, baseURL, placementCode, locale string) *http.Response {
	t.Helper()
	body, err := json.Marshal(map[string]string{"placementCode": placementCode, "locale": locale})
	if err != nil {
		t.Fatal(err)
	}
	req, err := http.NewRequest(http.MethodPost, baseURL+"/api/ads/decision", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://localhost:3000")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("post ad decision: %v", err)
	}
	return resp
}
