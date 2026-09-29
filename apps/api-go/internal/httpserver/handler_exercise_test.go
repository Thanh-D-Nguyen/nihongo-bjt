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

func TestExerciseStart_Success(t *testing.T) {
	db := testPool(t)
	sessStore := session.NewStore(db)
	router := NewRouter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:3000"}},
		Logger:       testLogger(),
		DBPool:       db,
		SessionStore: sessStore,
	})

	userID := newUUID(t)
	email := fmt.Sprintf("ex-start-%s@example.com", userID[:8])
	seedActiveUser(t, db, userID, "EX Start", email, "")
	rawToken := createLearnerSession(t, sessStore, userID)

	body := `{"exerciseType":"meaning_match","placement":"practice_tab"}`
	req := httptest.NewRequest(http.MethodPost, "/api/exercises/sessions", bytes.NewReader([]byte(body)))
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
	if resp["exerciseType"] != "meaning_match" {
		t.Errorf("expected exerciseType=meaning_match, got %v", resp["exerciseType"])
	}
	if resp["status"] != "active" {
		t.Errorf("expected status=active, got %v", resp["status"])
	}

	t.Cleanup(func() {
		cctx, ccancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer ccancel()
		_, _ = db.Exec(cctx, `DELETE FROM learner.exercise_attempt WHERE session_id IN (SELECT id FROM learner.exercise_session WHERE user_id = $1)`, userID)
		_, _ = db.Exec(cctx, `DELETE FROM learner.exercise_session WHERE user_id = $1`, userID)
	})
}

func TestExerciseStart_MissingType(t *testing.T) {
	db := testPool(t)
	sessStore := session.NewStore(db)
	router := NewRouter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:3000"}},
		Logger:       testLogger(),
		DBPool:       db,
		SessionStore: sessStore,
	})

	userID := newUUID(t)
	email := fmt.Sprintf("ex-notype-%s@example.com", userID[:8])
	seedActiveUser(t, db, userID, "EX NoType", email, "")
	rawToken := createLearnerSession(t, sessStore, userID)

	body := `{"placement":"practice_tab"}`
	req := httptest.NewRequest(http.MethodPost, "/api/exercises/sessions", bytes.NewReader([]byte(body)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for missing exerciseType, got %d", rr.Code)
	}
}

func TestExerciseSubmitAnswer_Success(t *testing.T) {
	db := testPool(t)
	sessStore := session.NewStore(db)
	router := NewRouter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:3000"}},
		Logger:       testLogger(),
		DBPool:       db,
		SessionStore: sessStore,
	})

	userID := newUUID(t)
	email := fmt.Sprintf("ex-ans-%s@example.com", userID[:8])
	seedActiveUser(t, db, userID, "EX Ans", email, "")
	rawToken := createLearnerSession(t, sessStore, userID)

	// Create session first.
	startBody := `{"exerciseType":"cloze","placement":"daily_hub"}`
	startReq := httptest.NewRequest(http.MethodPost, "/api/exercises/sessions", bytes.NewReader([]byte(startBody)))
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
	ansBody := fmt.Sprintf(`{"exerciseData":{"word":"test"},"userAnswer":{"value":"テスト"},"correct":true,"srsStateBefore":{"level":1},"srsStateAfter":{"level":2}}`)
	ansReq := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/exercises/sessions/%s/answer", sessionID), bytes.NewReader([]byte(ansBody)))
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
	if ansResp["correct"] != true {
		t.Errorf("expected correct=true, got %v", ansResp["correct"])
	}

	t.Cleanup(func() {
		cctx, ccancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer ccancel()
		_, _ = db.Exec(cctx, `DELETE FROM learner.exercise_attempt WHERE session_id IN (SELECT id FROM learner.exercise_session WHERE user_id = $1)`, userID)
		_, _ = db.Exec(cctx, `DELETE FROM learner.exercise_session WHERE user_id = $1`, userID)
	})
}

func TestExerciseComplete_Success(t *testing.T) {
	db := testPool(t)
	sessStore := session.NewStore(db)
	router := NewRouter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:3000"}},
		Logger:       testLogger(),
		DBPool:       db,
		SessionStore: sessStore,
	})

	userID := newUUID(t)
	email := fmt.Sprintf("ex-comp-%s@example.com", userID[:8])
	seedActiveUser(t, db, userID, "EX Comp", email, "")
	rawToken := createLearnerSession(t, sessStore, userID)

	// Create session.
	startBody := `{"exerciseType":"translation"}`
	startReq := httptest.NewRequest(http.MethodPost, "/api/exercises/sessions", bytes.NewReader([]byte(startBody)))
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

	// Complete session.
	compReq := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/exercises/sessions/%s/complete", sessionID), nil)
	compReq.Header.Set("Origin", "http://localhost:3000")
	compReq.Header.Set("X-CSRF-Token", "test-csrf")
	compReq.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	compRR := httptest.NewRecorder()
	router.ServeHTTP(compRR, compReq)

	if compRR.Code != http.StatusOK {
		t.Fatalf("complete: expected 200, got %d: %s", compRR.Code, compRR.Body.String())
	}

	var compResp map[string]any
	json.Unmarshal(compRR.Body.Bytes(), &compResp)
	if compResp["status"] != "completed" {
		t.Errorf("expected status=completed, got %v", compResp["status"])
	}

	t.Cleanup(func() {
		cctx, ccancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer ccancel()
		_, _ = db.Exec(cctx, `DELETE FROM learner.exercise_attempt WHERE session_id IN (SELECT id FROM learner.exercise_session WHERE user_id = $1)`, userID)
		_, _ = db.Exec(cctx, `DELETE FROM learner.exercise_session WHERE user_id = $1`, userID)
	})
}

func TestExercise_Unauthorized(t *testing.T) {
	db := testPool(t)
	sessStore := session.NewStore(db)
	router := NewRouter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:3000"}},
		Logger:       testLogger(),
		DBPool:       db,
		SessionStore: sessStore,
	})

	body := `{"exerciseType":"cloze"}`
	req := httptest.NewRequest(http.MethodPost, "/api/exercises/sessions", bytes.NewReader([]byte(body)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("X-CSRF-Token", "test-csrf")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 without session, got %d", rr.Code)
	}
}
