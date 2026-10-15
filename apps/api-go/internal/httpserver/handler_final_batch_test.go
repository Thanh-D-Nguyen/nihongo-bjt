package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPostAnalyticsEventsPersistsSingleAndBatchPayloads(t *testing.T) {
	db := testPool(t)
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	requests := []string{
		`{"eventName":"content_search_submitted","payload":{"query":"漢字","resultCount":3,"scope":"all","level":"N2"},"source":"learner_web"}`,
		`[{"eventName":"audit_batch_one","payload":{"n":1},"source":"local_audit"},{"eventName":"audit_batch_two","payload":{"n":2},"source":"local_audit"}]`,
	}
	ids := make([]string, 0, 3)
	t.Cleanup(func() {
		if len(ids) > 0 {
			_, _ = db.Exec(context.Background(), `DELETE FROM analytics.analytics_event WHERE id = ANY($1::uuid[])`, ids)
		}
	})

	for _, body := range requests {
		req := httptest.NewRequest(http.MethodPost, "/api/analytics/events", bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		res := httptest.NewRecorder()
		postAnalyticsEventsHandler(db, logger).ServeHTTP(res, req)
		if res.Code != http.StatusOK {
			t.Fatalf("POST status = %d, body=%s", res.Code, res.Body.String())
		}
		var result map[string]bool
		if err := json.Unmarshal(res.Body.Bytes(), &result); err != nil || !result["accepted"] {
			t.Fatalf("response = %s, want accepted=true (err=%v)", res.Body.String(), err)
		}
	}

	rows, err := db.Query(context.Background(), `SELECT id::text, event_name, source, payload FROM analytics.analytics_event WHERE (source='local_audit' AND event_name LIKE 'audit_batch_%') OR (event_name='content_search_submitted' AND source='learner_web') ORDER BY created_at DESC LIMIT 3`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	seen := map[string]bool{}
	for rows.Next() {
		var id, name, source string
		var payload []byte
		if err := rows.Scan(&id, &name, &source, &payload); err != nil {
			t.Fatal(err)
		}
		ids = append(ids, id)
		var values map[string]any
		if err := json.Unmarshal(payload, &values); err != nil {
			t.Fatal(err)
		}
		if name == "content_search_submitted" && (source != "learner_web" || values["query"] != "漢字" || values["resultCount"] != float64(3)) {
			t.Fatalf("persisted learner event = name:%s source:%s payload:%s", name, source, payload)
		}
		seen[name] = true
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"content_search_submitted", "audit_batch_one", "audit_batch_two"} {
		if !seen[name] {
			t.Errorf("event %q was not persisted", name)
		}
	}
}

func TestPostAnalyticsEventsRejectsInvalidEvent(t *testing.T) {
	db := testPool(t)
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	for _, body := range []string{`{`, `{"eventName":"","payload":{},"source":"learner_web"}`, `{"eventName":"event","payload":[],"source":"learner_web"}`} {
		req := httptest.NewRequest(http.MethodPost, "/api/analytics/events", bytes.NewBufferString(body))
		res := httptest.NewRecorder()
		postAnalyticsEventsHandler(db, logger).ServeHTTP(res, req)
		if res.Code != http.StatusBadRequest {
			t.Errorf("body %q returned %d, want 400: %s", body, res.Code, res.Body.String())
		}
	}
}

func TestPostAnalyticsEventsReturnsServerErrorWhenPersistenceFails(t *testing.T) {
	db := testPool(t)
	db.Close()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	req := httptest.NewRequest(http.MethodPost, "/api/analytics/events", bytes.NewBufferString(`{"eventName":"event","payload":{},"source":"learner_web"}`))
	res := httptest.NewRecorder()
	postAnalyticsEventsHandler(db, logger).ServeHTTP(res, req)
	if res.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500: %s", res.Code, res.Body.String())
	}
}

func TestPostAdsClickPersistsCanonicalMonetizationEvent(t *testing.T) {
	db := testPool(t)
	srv, _ := adminRBACTestServer(t)
	defer srv.Close()

	placementCode := "audit-click-" + newUUID(t)
	var placementID string
	if err := db.QueryRow(context.Background(), `INSERT INTO monetization.ad_placement (code, active, config, updated_at)
		VALUES ($1, TRUE, '{}'::jsonb, NOW()) RETURNING id`, placementCode).Scan(&placementID); err != nil {
		t.Fatalf("seed ad placement: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM monetization.ad_placement WHERE id=$1`, placementID)
	})

	body := `{"placementCode":"` + placementCode + `","decisionKey":"audit-decision-1","clientContext":{"locale":"vi","device":"desktop"}}`
	req, err := http.NewRequest(http.MethodPost, srv.URL+"/api/ads/click", bytes.NewBufferString(body))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://localhost:3000")
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("post click: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", resp.StatusCode)
	}
	var count int
	err = db.QueryRow(context.Background(), `SELECT count(*) FROM monetization.ad_impression
		WHERE placement_id=$1 AND kind='click' AND decision_key='audit-decision-1'
		AND client_context->>'locale'='vi' AND client_context->>'device'='desktop'`, placementID).Scan(&count)
	if err != nil {
		t.Fatalf("query click event: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected one persisted ad click, got %d events", count)
	}
}

func TestPostAdsClickRejectsInactivePlacement(t *testing.T) {
	db := testPool(t)
	srv, _ := adminRBACTestServer(t)
	defer srv.Close()

	placementCode := "audit-inactive-click-" + newUUID(t)
	var placementID string
	if err := db.QueryRow(context.Background(), `INSERT INTO monetization.ad_placement (code, active, config, updated_at)
		VALUES ($1, FALSE, '{}'::jsonb, NOW()) RETURNING id`, placementCode).Scan(&placementID); err != nil {
		t.Fatalf("seed inactive ad placement: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM monetization.ad_placement WHERE id=$1`, placementID)
	})

	req, err := http.NewRequest(http.MethodPost, srv.URL+"/api/ads/click", bytes.NewBufferString(`{"placementCode":"`+placementCode+`"}`))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://localhost:3000")
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("post inactive placement click: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", resp.StatusCode)
	}
}
