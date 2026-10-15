package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestAdminAnalyticsExecutiveEndpointExists verifies that GET /api/admin/analytics
// returns 200 with the AdminAnalyticsExecutiveResponse contract shape.
// This is the aggregate executive dashboard endpoint used by the admin overview page.
func TestAdminAnalyticsExecutiveEndpointExists(t *testing.T) {
	pool := testPool(t)
	userID := newUUID(t)
	seedActiveUser(t, pool, userID, "Admin analytics test", "analytics-"+userID+"@local.invalid", "")
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM learning.study_session WHERE user_id = $1`, userID)
		_, _ = pool.Exec(context.Background(), `DELETE FROM profile.user_profile WHERE id = $1`, userID)
	})
	if _, err := pool.Exec(context.Background(), `INSERT INTO learning.study_session (user_id, duration_minutes, started_at) VALUES ($1, 1, now() - interval '1 minute')`, userID); err != nil {
		t.Fatalf("seed study session: %v", err)
	}
	logger := testLogger()
	handler := adminAnalyticsExecutiveHandler(pool, logger)

	req := httptest.NewRequest(http.MethodGet, "/api/admin/analytics?days=30", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d; body: %s", rr.Code, rr.Body.String())
	}

	var resp map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("response is not valid JSON: %v", err)
	}

	// Verify top-level contract keys exist
	requiredKeys := []string{
		"activeContentCount", "executive", "latestRun", "metricTotals",
		"range", "rawEvents", "rollupAlignment", "userProfiles",
	}
	for _, k := range requiredKeys {
		if _, ok := resp[k]; !ok {
			t.Errorf("missing required top-level key: %s", k)
		}
	}

	// Verify executive.kpi sub-keys exist
	execRaw, ok := resp["executive"].(map[string]any)
	if !ok {
		t.Fatal("executive is not an object")
	}
	kpiRaw, ok := execRaw["kpi"].(map[string]any)
	if !ok {
		t.Fatal("executive.kpi is not an object")
	}
	kpiKeys := []string{
		"activeToday", "bjtCompletions", "d7", "dataFreshness",
		"flashcardReviews", "mau", "monetization", "newUsers",
		"searchSuccessRate", "wau",
	}
	for _, k := range kpiKeys {
		if _, ok := kpiRaw[k]; !ok {
			t.Errorf("missing executive.kpi key: %s", k)
		}
	}
	active := kpiRaw["activeToday"].(map[string]any)
	if active["available"] != true || active["value"].(float64) < 1 {
		t.Fatalf("active learners must include seeded distinct learner: %#v", active)
	}
	if resp["userProfiles"].(float64) < 1 {
		t.Fatalf("learner profile metric must use canonical profile table: %#v", resp["userProfiles"])
	}
}
