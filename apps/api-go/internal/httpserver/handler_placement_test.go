package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/placement"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func placementTestRouter(t *testing.T, db *pgxpool.Pool) (http.Handler, *session.Store) {
	t.Helper()
	sessions := session.NewStore(db)
	router := NewRouter(Dependencies{
		Config:         &config.Config{Port: "4001", CORSOrigins: []string{"http://localhost:18081"}},
		Logger:         testLogger(),
		SessionStore:   sessions,
		PlacementStore: placement.NewStore(db),
		Version:        "test",
	})
	return router, sessions
}

func TestPlacementOnboardingStatusUsesAuthenticatedLearner(t *testing.T) {
	db := testPool(t)
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Placement Learner", "placement-"+userID+"@example.test", "")
	router, sessions := placementTestRouter(t, db)
	raw := createLearnerSession(t, sessions, userID)

	unauthenticated := httptest.NewRecorder()
	router.ServeHTTP(unauthenticated, httptest.NewRequest(http.MethodGet, "/api/learner/onboarding", nil))
	if unauthenticated.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous onboarding status=%d body=%s", unauthenticated.Code, unauthenticated.Body.String())
	}

	req := httptest.NewRequest(http.MethodGet, "/api/learner/onboarding?userId=00000000-0000-4000-8000-000000000001", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: raw})
	response := httptest.NewRecorder()
	router.ServeHTTP(response, req)
	if response.Code != http.StatusOK {
		t.Fatalf("authenticated onboarding status=%d body=%s", response.Code, response.Body.String())
	}
	var got struct {
		CurrentStep string `json:"currentStep"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode onboarding status: %v body=%s", err, response.Body.String())
	}
	if got.CurrentStep != "not_started" {
		t.Fatalf("currentStep=%q, want not_started", got.CurrentStep)
	}
}

func TestPlacementUsesCanonicalQuestionsAndPersistsScore(t *testing.T) {
	db := testPool(t)
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Placement Learner", "placement-"+userID+"@example.test", "")
	questionID := seedPlacementQuestion(t, db)
	router, sessions := placementTestRouter(t, db)
	raw := createLearnerSession(t, sessions, userID)

	start := placementRequest(t, router, raw, http.MethodPost, "/api/learner/placement/start", `{}`)
	if start.Code != http.StatusOK {
		t.Fatalf("start placement status=%d body=%s", start.Code, start.Body.String())
	}
	var started struct {
		SessionID string `json:"sessionId"`
		Questions []struct {
			ID      string `json:"id"`
			Prompt  string `json:"prompt"`
			Options []struct {
				OptionKey string `json:"optionKey"`
				Text      string `json:"text"`
			} `json:"options"`
		} `json:"questions"`
	}
	if err := json.Unmarshal(start.Body.Bytes(), &started); err != nil {
		t.Fatalf("decode placement start: %v body=%s", err, start.Body.String())
	}
	if started.SessionID == "" || len(started.Questions) != 1 || started.Questions[0].ID != questionID || len(started.Questions[0].Options) != 2 {
		t.Fatalf("start response did not return canonical questions/options: %s", start.Body.String())
	}
	if strings.Contains(start.Body.String(), "isCorrect") {
		t.Fatalf("placement response leaked correct-answer key: %s", start.Body.String())
	}

	status := placementRequest(t, router, raw, http.MethodGet, "/api/learner/onboarding", "")
	var active struct {
		CurrentStep string `json:"currentStep"`
		SessionID   string `json:"sessionId"`
		Questions   []struct {
			ID string `json:"id"`
		} `json:"questions"`
	}
	if err := json.Unmarshal(status.Body.Bytes(), &active); err != nil {
		t.Fatalf("decode active status: %v body=%s", err, status.Body.String())
	}
	if status.Code != http.StatusOK || active.CurrentStep != "placement_active" || active.SessionID != started.SessionID || len(active.Questions) != 1 {
		t.Fatalf("active status=%d body=%s", status.Code, status.Body.String())
	}

	invalid := placementRequest(t, router, raw, http.MethodPost, "/api/learner/placement/submit", `{"sessionId":"`+started.SessionID+`","answers":{"`+questionID+`":"missing"}}`)
	if invalid.Code != http.StatusBadRequest {
		t.Fatalf("invalid answer status=%d body=%s", invalid.Code, invalid.Body.String())
	}

	answerBody, err := json.Marshal(map[string]any{"sessionId": started.SessionID, "answers": map[string]string{questionID: "A"}})
	if err != nil {
		t.Fatal(err)
	}
	result := placementRequest(t, router, raw, http.MethodPost, "/api/learner/placement/submit", string(answerBody))
	var scored struct {
		CorrectCount     int    `json:"correctCount"`
		EstimatedBjtBand string `json:"estimatedBjtBand"`
	}
	if result.Code != http.StatusOK {
		t.Fatalf("submit placement status=%d body=%s", result.Code, result.Body.String())
	}
	if err := json.Unmarshal(result.Body.Bytes(), &scored); err != nil {
		t.Fatalf("decode placement result: %v body=%s", err, result.Body.String())
	}
	if scored.CorrectCount != 1 || scored.EstimatedBjtBand != "A" {
		t.Fatalf("placement score=%+v body=%s", scored, result.Body.String())
	}

	completed := placementRequest(t, router, raw, http.MethodGet, "/api/learner/onboarding", "")
	var final struct {
		CurrentStep      string  `json:"currentStep"`
		CorrectCount     int     `json:"correctCount"`
		EstimatedBjtBand string  `json:"estimatedBjtBand"`
		OnboardedAt      *string `json:"onboardedAt"`
	}
	if err := json.Unmarshal(completed.Body.Bytes(), &final); err != nil {
		t.Fatalf("decode completed status: %v body=%s", err, completed.Body.String())
	}
	var onboardedAt *string
	if err := db.QueryRow(context.Background(), `SELECT onboarded_at::text FROM profile.learner_onboarding WHERE user_id=$1`, userID).Scan(&onboardedAt); err != nil {
		t.Fatalf("read persisted onboarding completion: %v", err)
	}
	if completed.Code != http.StatusOK || final.CurrentStep != "placement_complete" || final.CorrectCount != 1 || final.EstimatedBjtBand != "A" || onboardedAt == nil {
		t.Fatalf("completed status=%d body=%s onboardedAt=%v", completed.Code, completed.Body.String(), onboardedAt)
	}
}

func placementRequest(t *testing.T, router http.Handler, token, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
	if method != http.MethodGet {
		req.Header.Set("Origin", "http://localhost:18081")
		req.Header.Set("Content-Type", "application/json")
	}
	response := httptest.NewRecorder()
	router.ServeHTTP(response, req)
	return response
}

func seedPlacementQuestion(t *testing.T, db *pgxpool.Pool) string {
	t.Helper()
	ctx := context.Background()
	testID, sectionID, questionID := newUUID(t), newUUID(t), newUUID(t)
	if _, err := db.Exec(ctx, `INSERT INTO assessment.bjt_mock_test (id,slug,title_vi,type,status,updated_at) VALUES ($1,$2,'Placement fixture','mock','published',NOW())`, testID, "placement-"+testID); err != nil {
		t.Fatalf("insert placement test fixture: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM assessment.bjt_mock_test WHERE id=$1`, testID)
	})
	if _, err := db.Exec(ctx, `INSERT INTO assessment.bjt_test_section (id,test_id,code,title_vi,display_order) VALUES ($1,$2,'placement-fixture','Fixture',1)`, sectionID, testID); err != nil {
		t.Fatalf("insert placement section fixture: %v", err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO assessment.bjt_question (id,section_id,prompt,explanation_vi,skill_tag,status,updated_at) VALUES ($1,$2,'Fixture question','Fixture explanation','business','published',NOW())`, questionID, sectionID); err != nil {
		t.Fatalf("insert placement question fixture: %v", err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO assessment.bjt_question_option (question_id,option_key,text,is_correct) VALUES ($1,'A','Correct answer',true),($1,'B','Wrong answer',false)`, questionID); err != nil {
		t.Fatalf("insert placement options fixture: %v", err)
	}
	return questionID
}
