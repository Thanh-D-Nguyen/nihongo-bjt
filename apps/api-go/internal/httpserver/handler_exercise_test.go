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

	var exerciseID string
	if err := db.QueryRow(context.Background(), `INSERT INTO exercise.exercise
		(exercise_type, source_type, source_id, prompt, choices, correct_answer)
		VALUES ('meaning_match', 'lexeme', $1, '{"text":"仕事"}', '[{"key":"A","text":"công việc"}]', '{"key":"A"}') RETURNING id::text`, userID).Scan(&exerciseID); err != nil {
		t.Fatalf("create question fixture: %v", err)
	}
	for name, invalidBody := range map[string]string{
		"level":       fmt.Sprintf(`{"exerciseType":"meaning_match","exerciseIds":[%q],"level":"N123456789"}`, exerciseID),
		"sessionType": fmt.Sprintf(`{"exerciseType":"meaning_match","exerciseIds":[%q],"sessionType":"not_a_placement"}`, exerciseID),
		"placement":   fmt.Sprintf(`{"exerciseType":"meaning_match","exerciseIds":[%q],"placement":"not_a_placement"}`, exerciseID),
	} {
		invalidReq := httptest.NewRequest(http.MethodPost, "/api/exercises/sessions", bytes.NewBufferString(invalidBody))
		invalidReq.Header.Set("Content-Type", "application/json")
		invalidReq.Header.Set("Origin", "http://localhost:3000")
		invalidReq.Header.Set("X-CSRF-Token", "test-csrf")
		invalidReq.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
		invalidRR := httptest.NewRecorder()
		router.ServeHTTP(invalidRR, invalidReq)
		if invalidRR.Code != http.StatusBadRequest {
			t.Errorf("invalid %s: expected 400, got %d: %s", name, invalidRR.Code, invalidRR.Body.String())
		}
	}

	body := fmt.Sprintf(`{"exerciseType":"meaning_match","exerciseIds":[%q],"placement":"practice_tab"}`, exerciseID)
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
		_, _ = db.Exec(cctx, `DELETE FROM exercise.exercise_answer WHERE session_id IN (SELECT id FROM exercise.exercise_session WHERE user_id = $1)`, userID)
		_, _ = db.Exec(cctx, `DELETE FROM exercise.exercise_session WHERE user_id = $1`, userID)
		_, _ = db.Exec(cctx, `DELETE FROM exercise.exercise WHERE id = $1`, exerciseID)
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

func TestExerciseGenerate_ReturnsPersistedQuestionsWithoutAnswers(t *testing.T) {
	db := testPool(t)
	sessStore := session.NewStore(db)
	router := NewRouter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:3000"}},
		Logger:       testLogger(),
		DBPool:       db,
		SessionStore: sessStore,
	})
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "EX Generate", fmt.Sprintf("ex-generate-%s@example.test", userID[:8]), "")
	lexemePrefix := "audit-exercise-" + userID + "-"
	if _, err := db.Exec(context.Background(), `INSERT INTO content.lexeme (headword, reading, short_meaning_vi, jlpt_level, created_at, updated_at)
		SELECT $1 || n::text, 'ご' || n::text, 'nghĩa ' || n::text, 'N5', NOW(), NOW() FROM generate_series(1, 50) n`, lexemePrefix); err != nil {
		t.Fatalf("create canonical vocabulary fixtures: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM exercise.exercise WHERE source_id IN (SELECT id FROM content.lexeme WHERE headword LIKE $1 || '%')`, lexemePrefix)
		_, _ = db.Exec(context.Background(), `DELETE FROM content.lexeme WHERE headword LIKE $1 || '%'`, lexemePrefix)
		_, _ = db.Exec(context.Background(), `DELETE FROM auth.session WHERE user_id = $1`, userID)
		_, _ = db.Exec(context.Background(), `DELETE FROM profile.user_profile WHERE id = $1`, userID)
	})
	token := createLearnerSession(t, sessStore, userID)
	req := httptest.NewRequest(http.MethodPost, "/api/exercises/generate", bytes.NewBufferString(`{"type":"meaning_match","count":10}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
	response := httptest.NewRecorder()
	router.ServeHTTP(response, req)
	if response.Code != http.StatusOK {
		t.Fatalf("generate status = %d: %s", response.Code, response.Body.String())
	}
	var exercises []struct {
		ID            string              `json:"id"`
		ExerciseType  string              `json:"exerciseType"`
		Prompt        map[string]any      `json:"prompt"`
		Choices       []map[string]string `json:"choices"`
		CorrectAnswer json.RawMessage     `json:"correctAnswer"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &exercises); err != nil {
		t.Fatalf("decode generated questions: %v", err)
	}
	if len(exercises) != 10 {
		t.Fatalf("generated %d questions; want 10", len(exercises))
	}
	for _, ex := range exercises {
		if ex.ID == "" || ex.ExerciseType != "meaning_match" || len(ex.Choices) != 4 || len(ex.Prompt) == 0 || len(ex.CorrectAnswer) != 0 {
			t.Fatalf("invalid or answer-leaking question: %+v", ex)
		}
	}
}

func TestWordOrderDraftsRejectMixedJapaneseAndEnglishExamples(t *testing.T) {
	drafts := wordOrderDrafts([]exerciseSentence{{
		ID:          "mixed-example",
		Japanese:    "リンゴを真ん中から二つに切った.\nI cut the apple into two halves.",
		Translation: "Tôi bổ quả táo làm đôi từ chính giữa.",
	}}, 1)
	if len(drafts) != 0 {
		t.Fatalf("mixed-language example generated a word-order exercise: %+v", drafts[0].prompt)
	}
}

func TestPersistExerciseDraftsReusesCachedQuestion(t *testing.T) {
	db := testPool(t)
	userID := newUUID(t)
	draft := exerciseDraft{sourceType: "lexeme", sourceID: userID, prompt: map[string]any{"text": "仕事"}, choices: []exerciseChoice{{Key: "A", Text: "công việc"}}, correctAnswer: map[string]string{"key": "A"}}
	first, err := persistExerciseDrafts(context.Background(), db, "meaning_match", []exerciseDraft{draft})
	if err != nil {
		t.Fatalf("first generation: %v", err)
	}
	second, err := persistExerciseDrafts(context.Background(), db, "meaning_match", []exerciseDraft{draft})
	if err != nil {
		t.Fatalf("retry generation: %v", err)
	}
	if len(first) != 1 || len(second) != 1 || first[0].ID != second[0].ID || first[0].Prompt["text"] != second[0].Prompt["text"] {
		t.Fatalf("generation retry returned inconsistent cached question: first=%+v second=%+v", first, second)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM exercise.exercise WHERE generation_key = $1`, "meaning_match:lexeme:"+userID)
	})
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

	// Create and assign a persisted question to the session.
	var exerciseID string
	err := db.QueryRow(context.Background(), `INSERT INTO exercise.exercise
		(exercise_type, source_type, source_id, prompt, choices, correct_answer)
		VALUES ('meaning_match', 'lexeme', $1, '{"text":"仕事"}', '[{"key":"A","text":"công việc"}]', '{"key":"A"}') RETURNING id::text`, userID).Scan(&exerciseID)
	if err != nil {
		t.Fatalf("create question fixture: %v", err)
	}
	var unassignedID string
	if err := db.QueryRow(context.Background(), `INSERT INTO exercise.exercise
		(exercise_type, source_type, source_id, prompt, choices, correct_answer)
		VALUES ('meaning_match', 'lexeme', $1, '{"text":"別の語"}', '[]', '{"key":"A"}') RETURNING id::text`, userID).Scan(&unassignedID); err != nil {
		t.Fatalf("create unassigned question: %v", err)
	}
	startBody := fmt.Sprintf(`{"sessionType":"practice_tab","exerciseType":"meaning_match","exerciseIds":[%q]}`, exerciseID)
	startReq := httptest.NewRequest(http.MethodPost, "/api/exercises/sessions", bytes.NewBufferString(startBody))
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
	if err := json.Unmarshal(startRR.Body.Bytes(), &startResp); err != nil {
		t.Fatal(err)
	}
	sessionID := startResp["id"].(string)
	unassignedBody := fmt.Sprintf(`{"exerciseId":%q,"userAnswer":{"key":"A"},"timeSpentMs":15}`, unassignedID)
	unassignedReq := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/exercises/sessions/%s/answer", sessionID), bytes.NewBufferString(unassignedBody))
	unassignedReq.Header.Set("Content-Type", "application/json")
	unassignedReq.Header.Set("Origin", "http://localhost:3000")
	unassignedReq.Header.Set("X-CSRF-Token", "test-csrf")
	unassignedReq.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	unassignedRR := httptest.NewRecorder()
	router.ServeHTTP(unassignedRR, unassignedReq)
	if unassignedRR.Code != http.StatusNotFound {
		t.Fatalf("unassigned question status = %d; want 404: %s", unassignedRR.Code, unassignedRR.Body.String())
	}
	ansBody := fmt.Sprintf(`{"exerciseId":%q,"userAnswer":{"key":"A"},"timeSpentMs":147}`, exerciseID)
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
	if ansResp["isCorrect"] != true {
		t.Errorf("expected server-scored correct answer, got %v", ansResp)
	}

	t.Cleanup(func() {
		cctx, ccancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer ccancel()
		_, _ = db.Exec(cctx, `DELETE FROM exercise.exercise_answer WHERE session_id IN (SELECT id FROM exercise.exercise_session WHERE user_id = $1)`, userID)
		_, _ = db.Exec(cctx, `DELETE FROM exercise.exercise_session WHERE user_id = $1`, userID)
		_, _ = db.Exec(cctx, `DELETE FROM exercise.exercise WHERE id = ANY($1::uuid[])`, []string{exerciseID})
		_, _ = db.Exec(cctx, `DELETE FROM exercise.exercise WHERE id = $1`, unassignedID)
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

	var exerciseID string
	if err := db.QueryRow(context.Background(), `INSERT INTO exercise.exercise
		(exercise_type, source_type, source_id, prompt, choices, correct_answer)
		VALUES ('translation', 'example_sentence', $1, '{"japaneseSentence":"仕事です"}', '[]', '{"text":"It is work."}') RETURNING id::text`, userID).Scan(&exerciseID); err != nil {
		t.Fatalf("create question fixture: %v", err)
	}
	startBody := fmt.Sprintf(`{"exerciseType":"translation","exerciseIds":[%q]}`, exerciseID)
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

	// An unfinished assignment cannot be completed.
	compReq := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/exercises/sessions/%s/complete", sessionID), nil)
	compReq.Header.Set("Origin", "http://localhost:3000")
	compReq.Header.Set("X-CSRF-Token", "test-csrf")
	compReq.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	compRR := httptest.NewRecorder()
	router.ServeHTTP(compRR, compReq)
	if compRR.Code != http.StatusConflict {
		t.Fatalf("unfinished completion: expected 409, got %d: %s", compRR.Code, compRR.Body.String())
	}

	answerBody := fmt.Sprintf(`{"exerciseId":%q,"userAnswer":{"text":"It is work."},"timeSpentMs":1000}`, exerciseID)
	answerReq := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/exercises/sessions/%s/answer", sessionID), bytes.NewBufferString(answerBody))
	answerReq.Header.Set("Content-Type", "application/json")
	answerReq.Header.Set("Origin", "http://localhost:3000")
	answerReq.Header.Set("X-CSRF-Token", "test-csrf")
	answerReq.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	answerRR := httptest.NewRecorder()
	router.ServeHTTP(answerRR, answerReq)
	if answerRR.Code != http.StatusCreated {
		t.Fatalf("answer: expected 201, got %d: %s", answerRR.Code, answerRR.Body.String())
	}

	// Completing after every assigned question has been answered succeeds.
	compReq = httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/exercises/sessions/%s/complete", sessionID), nil)
	compReq.Header.Set("Origin", "http://localhost:3000")
	compReq.Header.Set("X-CSRF-Token", "test-csrf")
	compReq.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	compRR = httptest.NewRecorder()
	router.ServeHTTP(compRR, compReq)

	if compRR.Code != http.StatusOK {
		t.Fatalf("complete: expected 200, got %d: %s", compRR.Code, compRR.Body.String())
	}

	var compResp map[string]any
	json.Unmarshal(compRR.Body.Bytes(), &compResp)
	if compResp["status"] != "completed" {
		t.Errorf("expected status=completed, got %v", compResp["status"])
	}
	if compResp["totalQuestions"] != float64(1) || compResp["correctCount"] != float64(1) || compResp["score"] != float64(10) {
		t.Errorf("expected persisted totals 1/1/10, got %v/%v/%v", compResp["totalQuestions"], compResp["correctCount"], compResp["score"])
	}

	t.Cleanup(func() {
		cctx, ccancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer ccancel()
		_, _ = db.Exec(cctx, `DELETE FROM exercise.exercise_answer WHERE session_id IN (SELECT id FROM exercise.exercise_session WHERE user_id = $1)`, userID)
		_, _ = db.Exec(cctx, `DELETE FROM exercise.exercise_session WHERE user_id = $1`, userID)
		_, _ = db.Exec(cctx, `DELETE FROM exercise.exercise WHERE id = $1`, exerciseID)
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
