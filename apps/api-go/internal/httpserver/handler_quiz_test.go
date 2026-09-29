package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func TestQuizStart_Success(t *testing.T) {
	db := testPool(t)
	sessStore := session.NewStore(db)
	router := NewRouter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:3000"}},
		Logger:       testLogger(),
		DBPool:       db,
		SessionStore: sessStore,
	})

	userID := newUUID(t)
	email := fmt.Sprintf("qz-start-%s@example.com", userID[:8])
	seedActiveUser(t, db, userID, "QZ Start", email, "")
	rawToken := createLearnerSession(t, sessStore, userID)

	templateID := newUUID(t)
	body := fmt.Sprintf(`{"templateId":"%s"}`, templateID)
	req := httptest.NewRequest(http.MethodPost, "/api/quiz/start", bytes.NewReader([]byte(body)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rr.Code, rr.Body.String())
	}

	var resp map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp["id"] == nil || resp["id"] == "" {
		t.Error("expected id in response")
	}
	if resp["templateId"] != templateID {
		t.Errorf("expected templateId=%s, got %v", templateID, resp["templateId"])
	}
	if resp["status"] != "active" {
		t.Errorf("expected status=active, got %v", resp["status"])
	}

	t.Cleanup(func() {
		cctx, ccancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer ccancel()
		_, _ = db.Exec(cctx, `DELETE FROM learner.quiz_answer WHERE session_id IN (SELECT id FROM learner.quiz_session WHERE user_id = $1)`, userID)
		_, _ = db.Exec(cctx, `DELETE FROM learner.quiz_session WHERE user_id = $1`, userID)
	})
}

func TestQuizStart_MissingTemplateID(t *testing.T) {
	db := testPool(t)
	sessStore := session.NewStore(db)
	router := NewRouter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:3000"}},
		Logger:       testLogger(),
		DBPool:       db,
		SessionStore: sessStore,
	})

	userID := newUUID(t)
	email := fmt.Sprintf("qz-notmpl-%s@example.com", userID[:8])
	seedActiveUser(t, db, userID, "QZ NoTmpl", email, "")
	rawToken := createLearnerSession(t, sessStore, userID)

	body := `{}`
	req := httptest.NewRequest(http.MethodPost, "/api/quiz/start", bytes.NewReader([]byte(body)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for missing templateId, got %d", rr.Code)
	}
}

func TestQuizSubmitAnswer_Success(t *testing.T) {
	db := testPool(t)
	sessStore := session.NewStore(db)
	router := NewRouter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:3000"}},
		Logger:       testLogger(),
		DBPool:       db,
		SessionStore: sessStore,
	})

	userID := newUUID(t)
	email := fmt.Sprintf("qz-ans-%s@example.com", userID[:8])
	seedActiveUser(t, db, userID, "QZ Ans", email, "")
	rawToken := createLearnerSession(t, sessStore, userID)

	// Create quiz session first.
	templateID := newUUID(t)
	startBody := fmt.Sprintf(`{"templateId":"%s"}`, templateID)
	startReq := httptest.NewRequest(http.MethodPost, "/api/quiz/start", bytes.NewReader([]byte(startBody)))
	startReq.Header.Set("Content-Type", "application/json")
	startReq.Header.Set("Origin", "http://localhost:3000")
	startReq.Header.Set("X-CSRF-Token", "test-csrf")
	startReq.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	startRR := httptest.NewRecorder()
	router.ServeHTTP(startRR, startReq)
	if startRR.Code != http.StatusCreated {
		t.Fatalf("start: expected 201, got %d: %s", startRR.Code, startRR.Body.String())
	}
	var startResp map[string]any
	json.Unmarshal(startRR.Body.Bytes(), &startResp)
	sessionID := startResp["id"].(string)

	// Submit answer.
	questionID := newUUID(t)
	ansBody := fmt.Sprintf(`{"questionId":"%s","selectedOption":"A"}`, questionID)
	ansReq := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/quiz/session/%s/answer", sessionID), bytes.NewReader([]byte(ansBody)))
	ansReq.Header.Set("Content-Type", "application/json")
	ansReq.Header.Set("Origin", "http://localhost:3000")
	ansReq.Header.Set("X-CSRF-Token", "test-csrf")
	ansReq.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	ansRR := httptest.NewRecorder()
	router.ServeHTTP(ansRR, ansReq)

	if ansRR.Code != http.StatusCreated {
		t.Fatalf("answer: expected 201, got %d: %s", ansRR.Code, ansRR.Body.String())
	}

	var ansResp map[string]any
	if err := json.Unmarshal(ansRR.Body.Bytes(), &ansResp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if ansResp["sessionId"] != sessionID {
		t.Errorf("expected sessionId=%s, got %v", sessionID, ansResp["sessionId"])
	}
	if ansResp["questionId"] != questionID {
		t.Errorf("expected questionId=%s, got %v", questionID, ansResp["questionId"])
	}

	t.Cleanup(func() {
		cctx, ccancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer ccancel()
		_, _ = db.Exec(cctx, `DELETE FROM learner.quiz_answer WHERE session_id IN (SELECT id FROM learner.quiz_session WHERE user_id = $1)`, userID)
		_, _ = db.Exec(cctx, `DELETE FROM learner.quiz_session WHERE user_id = $1`, userID)
	})
}

func TestQuizSubmitAnswer_MissingFields(t *testing.T) {
	db := testPool(t)
	sessStore := session.NewStore(db)
	router := NewRouter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:3000"}},
		Logger:       testLogger(),
		DBPool:       db,
		SessionStore: sessStore,
	})

	userID := newUUID(t)
	email := fmt.Sprintf("qz-nofields-%s@example.com", userID[:8])
	seedActiveUser(t, db, userID, "QZ NoFields", email, "")
	rawToken := createLearnerSession(t, sessStore, userID)

	// Create session.
	templateID := newUUID(t)
	startBody := fmt.Sprintf(`{"templateId":"%s"}`, templateID)
	startReq := httptest.NewRequest(http.MethodPost, "/api/quiz/start", bytes.NewReader([]byte(startBody)))
	startReq.Header.Set("Content-Type", "application/json")
	startReq.Header.Set("Origin", "http://localhost:3000")
	startReq.Header.Set("X-CSRF-Token", "test-csrf")
	startReq.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	startRR := httptest.NewRecorder()
	router.ServeHTTP(startRR, startReq)
	if startRR.Code != http.StatusCreated {
		t.Fatalf("start: expected 201, got %d", startRR.Code)
	}
	var startResp map[string]any
	json.Unmarshal(startRR.Body.Bytes(), &startResp)
	sessionID := startResp["id"].(string)

	// Submit with missing fields.
	ansBody := `{}`
	ansReq := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/quiz/session/%s/answer", sessionID), bytes.NewReader([]byte(ansBody)))
	ansReq.Header.Set("Content-Type", "application/json")
	ansReq.Header.Set("Origin", "http://localhost:3000")
	ansReq.Header.Set("X-CSRF-Token", "test-csrf")
	ansReq.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	ansRR := httptest.NewRecorder()
	router.ServeHTTP(ansRR, ansReq)

	if ansRR.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for missing fields, got %d", ansRR.Code)
	}

	t.Cleanup(func() {
		cctx, ccancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer ccancel()
		_, _ = db.Exec(cctx, `DELETE FROM learner.quiz_answer WHERE session_id IN (SELECT id FROM learner.quiz_session WHERE user_id = $1)`, userID)
		_, _ = db.Exec(cctx, `DELETE FROM learner.quiz_session WHERE user_id = $1`, userID)
	})
}

func TestQuiz_Unauthorized(t *testing.T) {
	db := testPool(t)
	sessStore := session.NewStore(db)
	router := NewRouter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:3000"}},
		Logger:       testLogger(),
		DBPool:       db,
		SessionStore: sessStore,
	})

	body := `{"templateId":"some-template"}`
	req := httptest.NewRequest(http.MethodPost, "/api/quiz/start", bytes.NewReader([]byte(body)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("X-CSRF-Token", "test-csrf")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 without session, got %d", rr.Code)
	}
}
