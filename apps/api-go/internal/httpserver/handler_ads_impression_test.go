package httpserver

import (
	"bytes"
	"context"
	"net/http"
	"strings"
	"testing"
)

func TestPostAdsImpressionPersistsCanonicalMonetizationEvent(t *testing.T) {
	db := testPool(t)
	srv, _ := adminRBACTestServer(t)
	defer srv.Close()

	placementCode := "audit-impression-" + newUUID(t)
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
	if err := db.QueryRow(context.Background(), `INSERT INTO monetization.ad_campaign
		(name, status, provider_key, placement_codes, creative_type, destination_url, policy_status, created_at, updated_at)
		VALUES ('Audit impression', 'active', $1, jsonb_build_array($2::text), 'storefront', 'https://example.test/store', 'ok', NOW(), NOW()) RETURNING id`, providerKey, placementCode).Scan(&campaignID); err != nil {
		t.Fatalf("seed campaign: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM monetization.ad_campaign WHERE id=$1`, campaignID)
		_, _ = db.Exec(context.Background(), `DELETE FROM monetization.ad_provider_config WHERE key=$1`, providerKey)
		_, _ = db.Exec(context.Background(), `DELETE FROM monetization.ad_placement WHERE id=$1`, placementID)
	})

	body := `{"placementCode":"` + placementCode + `","campaignId":"` + campaignID + `","decisionKey":"local:audit-impression","clientContext":{"locale":"vi","device":"desktop"}}`
	resp := postAdsImpression(t, srv.URL, body)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", resp.StatusCode)
	}
	var count int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM monetization.ad_impression
		WHERE placement_id=$1 AND campaign_id=$2 AND kind='impression' AND decision_key='local:audit-impression'
		AND client_context->>'locale'='vi' AND client_context->>'device'='desktop'`, placementID, campaignID).Scan(&count); err != nil {
		t.Fatalf("query impression event: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected one persisted ad impression, got %d events", count)
	}

	resp2 := postAdsImpression(t, srv.URL, strings.Replace(body, campaignID, newUUID(t), 1))
	defer resp2.Body.Close()
	if resp2.StatusCode != http.StatusBadRequest {
		t.Fatalf("mismatched campaign status = %d, want 400", resp2.StatusCode)
	}
	resp3 := postAdsImpression(t, srv.URL, "{")
	defer resp3.Body.Close()
	if resp3.StatusCode != http.StatusBadRequest {
		t.Fatalf("malformed body status = %d, want 400", resp3.StatusCode)
	}
	if _, err := db.Exec(context.Background(), `UPDATE monetization.ad_placement SET active=FALSE WHERE id=$1`, placementID); err != nil {
		t.Fatalf("deactivate placement: %v", err)
	}
	resp4 := postAdsImpression(t, srv.URL, body)
	defer resp4.Body.Close()
	if resp4.StatusCode != http.StatusNotFound {
		t.Fatalf("inactive placement status = %d, want 404", resp4.StatusCode)
	}
}

func postAdsImpression(t *testing.T, baseURL, body string) *http.Response {
	t.Helper()
	req, err := http.NewRequest(http.MethodPost, baseURL+"/api/ads/impression", bytes.NewBufferString(body))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://localhost:3000")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("post impression: %v", err)
	}
	return resp
}
