package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
)

func TestFeedbackPostPersistsSubmission(t *testing.T) {
	db := testPool(t)
	limiter, err := authn.NewRateLimiter(authn.DefaultRateLimiterConfig())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(limiter.Stop)
	router := NewRouter(Dependencies{Config: &config.Config{}, Logger: testLogger(), DBPool: db, RateLimiter: limiter})
	request := httptest.NewRequest(http.MethodPost, "/api/feedback", bytes.NewBufferString(`{"name":"Audit learner","email":"audit@example.com","category":"bug","message":"Feedback persistence audit"}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusCreated {
		t.Fatalf("feedback status=%d want 201 body=%s", response.Code, response.Body.String())
	}
	var payload struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil || payload.ID == "" {
		t.Fatalf("feedback response must include persisted id: body=%s err=%v", response.Body.String(), err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.feedback_submission WHERE id=$1`, payload.ID)
	})
	var name, email, category, message string
	if err := db.QueryRow(context.Background(), `SELECT name,email,category,message FROM ops.feedback_submission WHERE id=$1`, payload.ID).Scan(&name, &email, &category, &message); err != nil {
		t.Fatalf("load persisted feedback: %v", err)
	}
	if name != "Audit learner" || email != "audit@example.com" || category != "bug" || message != "Feedback persistence audit" {
		t.Fatalf("persisted feedback mismatch: %q %q %q %q", name, email, category, message)
	}
}

func TestFeedbackRejectsInvalidPayloadAndRateLimitOverflow(t *testing.T) {
	db := testPool(t)
	limiterConfig := authn.DefaultRateLimiterConfig()
	limiterConfig.Limit = 1
	limiter, err := authn.NewRateLimiter(limiterConfig)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(limiter.Stop)
	router := NewRouter(Dependencies{Config: &config.Config{}, Logger: testLogger(), DBPool: db, RateLimiter: limiter})
	message := "Feedback rate limit audit " + newUUID(t)
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.feedback_submission WHERE message=$1`, message)
	})
	post := func(payload, forwardedIP string) *httptest.ResponseRecorder {
		t.Helper()
		request := httptest.NewRequest(http.MethodPost, "/api/feedback", bytes.NewBufferString(payload))
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("X-Forwarded-For", forwardedIP)
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request)
		return response
	}
	invalid := post(`{"category":"invalid","message":"Feedback validation audit"}`, "203.0.113.1")
	if invalid.Code != http.StatusBadRequest {
		t.Fatalf("feedback invalid status=%d want 400 body=%s", invalid.Code, invalid.Body.String())
	}
	payload := `{"category":"other","message":"` + message + `"}`
	if first := post(payload, "203.0.113.2"); first.Code != http.StatusCreated {
		t.Fatalf("feedback rate first status=%d want 201 body=%s", first.Code, first.Body.String())
	}
	if second := post(payload, "203.0.113.99"); second.Code != http.StatusTooManyRequests {
		t.Fatalf("feedback rate overflow status=%d want 429 body=%s", second.Code, second.Body.String())
	}
	var count int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM ops.feedback_submission WHERE message=$1`, message).Scan(&count); err != nil {
		t.Fatalf("count rate-limited submissions: %v", err)
	}
	if count != 1 {
		t.Fatalf("persisted %d submissions after one allowed request, want 1", count)
	}
}

func TestFeedbackRejectsEmptyMessage(t *testing.T) {
	db := testPool(t)
	limiter, err := authn.NewRateLimiter(authn.DefaultRateLimiterConfig())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(limiter.Stop)
	router := NewRouter(Dependencies{Config: &config.Config{}, Logger: testLogger(), DBPool: db, RateLimiter: limiter})
	request := httptest.NewRequest(http.MethodPost, "/api/feedback", bytes.NewBufferString(`{"category":"bug","message":"   "}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusBadRequest {
		t.Fatalf("feedback empty message status=%d want 400 body=%s", response.Code, response.Body.String())
	}
}
