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

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/quiztemplate"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/studyplan"
)

func TestStudyPlanProgressUsesCanonicalSchema(t *testing.T) {
	db := testPool(t)
	sessions := session.NewStore(db)
	store := studyplan.NewStore(db)
	router := NewRouter(Dependencies{Config: &config.Config{CORSOrigins: []string{"http://localhost:3000"}}, Logger: testLogger(), DBPool: db, SessionStore: sessions, StudyPlanStore: store})
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Quiz study plan", fmt.Sprintf("quiz-study-plan-%s@example.com", userID[:8]), "")
	token := createLearnerSession(t, sessions, userID)

	initial := quizRequest(t, router, token, http.MethodGet, "/api/gamification/study-plan/today", "")
	if initial.Code != http.StatusOK || !bytes.Contains(initial.Body.Bytes(), []byte(`"targetMinutes":20`)) {
		t.Fatalf("today plan: want 200, got %d: %s", initial.Code, initial.Body.String())
	}
	progress := quizRequest(t, router, token, http.MethodPost, "/api/gamification/study-plan/progress", `{"taskType":"bjt_quiz"}`)
	if progress.Code != http.StatusOK || !bytes.Contains(progress.Body.Bytes(), []byte(`"doneCount":1`)) || !bytes.Contains(progress.Body.Bytes(), []byte(`"isComplete":true`)) {
		t.Fatalf("study progress: want completed bjt_quiz task, got %d: %s", progress.Code, progress.Body.String())
	}

	refreshed := quizRequest(t, router, token, http.MethodGet, "/api/gamification/study-plan/today", "")
	if refreshed.Code != http.StatusOK || !bytes.Contains(refreshed.Body.Bytes(), []byte(`"taskType":"bjt_quiz","label":"BJT Quiz","targetCount":1,"doneCount":1,"isComplete":true`)) {
		t.Fatalf("study progress must persist in the canonical task row, got %d: %s", refreshed.Code, refreshed.Body.String())
	}
}

func TestQuizAssessmentJourneyAndOwnership(t *testing.T) {
	db := testPool(t)
	sessions := session.NewStore(db)
	router := NewRouter(Dependencies{Config: &config.Config{CORSOrigins: []string{"http://localhost:3000"}}, Logger: testLogger(), DBPool: db, SessionStore: sessions, StudyPlanStore: studyplan.NewStore(db)})
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Quiz journey", fmt.Sprintf("quiz-journey-%s@example.com", userID[:8]), "")
	rawToken := createLearnerSession(t, sessions, userID)
	templateID := seedQuizTemplate(t, db, 2)
	if _, err := db.Exec(context.Background(), `UPDATE assessment.bjt_mock_test SET time_limit_seconds=900 WHERE id=$1`, templateID); err != nil {
		t.Fatal(err)
	}

	started := quizRequest(t, router, rawToken, http.MethodPost, "/api/quiz/start", fmt.Sprintf(`{"templateId":%q}`, templateID))
	if started.Code != http.StatusCreated {
		t.Fatalf("start: want 201, got %d: %s", started.Code, started.Body.String())
	}
	var startData map[string]any
	if err := json.Unmarshal(started.Body.Bytes(), &startData); err != nil {
		t.Fatal(err)
	}
	sessionID := startData["id"].(string)
	if _, err := db.Exec(context.Background(), `UPDATE assessment.quiz_session SET started_at=NOW()+INTERVAL '1 second' WHERE id=$1`, sessionID); err != nil {
		t.Fatal(err)
	}

	active := quizRequest(t, router, rawToken, http.MethodGet, "/api/quiz/session/active?userId=attacker", "")
	if active.Code != http.StatusOK || !bytes.Contains(active.Body.Bytes(), []byte(sessionID)) {
		t.Fatalf("active session must be scoped to the cookie identity: %d %s", active.Code, active.Body.String())
	}
	var activeData struct {
		Session struct {
			TimeLimitSeconds int `json:"timeLimitSeconds"`
			RemainingSeconds int `json:"remainingSeconds"`
		} `json:"session"`
	}
	if err := json.Unmarshal(active.Body.Bytes(), &activeData); err != nil {
		t.Fatal(err)
	}
	if activeData.Session.TimeLimitSeconds != 900 || activeData.Session.RemainingSeconds <= 0 || activeData.Session.RemainingSeconds > 900 {
		t.Fatalf("active session timer must use seconds, got timeLimit=%d remaining=%d", activeData.Session.TimeLimitSeconds, activeData.Session.RemainingSeconds)
	}
	var lastQuestion string
	for i := 0; i < 2; i++ {
		questionRes := quizRequest(t, router, rawToken, http.MethodGet, "/api/quiz/session/"+sessionID+"/question?userId=attacker", "")
		if questionRes.Code != http.StatusOK {
			t.Fatalf("question %d: want 200, got %d: %s", i, questionRes.Code, questionRes.Body.String())
		}
		var questionData struct {
			Question struct {
				ID      string           `json:"id"`
				Options []map[string]any `json:"options"`
			} `json:"question"`
		}
		if err := json.Unmarshal(questionRes.Body.Bytes(), &questionData); err != nil {
			t.Fatal(err)
		}
		lastQuestion = questionData.Question.ID
		if lastQuestion == "" || len(questionData.Question.Options) != 2 {
			t.Fatalf("question contract missing content/options: %s", questionRes.Body.String())
		}
		for _, option := range questionData.Question.Options {
			if _, leaksAnswer := option["isCorrect"]; leaksAnswer {
				t.Fatal("question response exposed the correct answer")
			}
		}
		selected := "A"
		if i == 1 {
			selected = "B"
		}
		answerRes := quizRequest(t, router, rawToken, http.MethodPost, "/api/quiz/session/"+sessionID+"/answer", fmt.Sprintf(`{"questionId":%q,"selectedOption":%q}`, lastQuestion, selected))
		if answerRes.Code != http.StatusCreated {
			t.Fatalf("answer %d: want 201, got %d: %s", i, answerRes.Code, answerRes.Body.String())
		}
	}

	results := quizRequest(t, router, rawToken, http.MethodGet, "/api/quiz/session/"+sessionID+"/results?userId=attacker", "")
	if results.Code != http.StatusOK || !bytes.Contains(results.Body.Bytes(), []byte(`"status":"completed"`)) || !bytes.Contains(results.Body.Bytes(), []byte(`"correctCount":1`)) {
		t.Fatalf("results contract: %d %s", results.Code, results.Body.String())
	}
	breakdown := quizRequest(t, router, rawToken, http.MethodGet, "/api/quiz/session/"+sessionID+"/results/breakdown", "")
	if breakdown.Code != http.StatusOK || !bytes.Contains(breakdown.Body.Bytes(), []byte(`"breakdown"`)) {
		t.Fatalf("breakdown contract: %d %s", breakdown.Code, breakdown.Body.String())
	}
	history := quizRequest(t, router, rawToken, http.MethodGet, "/api/quiz/session/history?userId=attacker&limit=1", "")
	if history.Code != http.StatusOK || !bytes.Contains(history.Body.Bytes(), []byte(sessionID)) {
		t.Fatalf("history contract: %d %s", history.Code, history.Body.String())
	}
	active = quizRequest(t, router, rawToken, http.MethodGet, "/api/quiz/session/active", "")
	if active.Code != http.StatusOK || !bytes.Contains(active.Body.Bytes(), []byte(`"session":null`)) {
		t.Fatalf("completed session must not be active: %d %s", active.Code, active.Body.String())
	}
	var quizProgress int
	if err := db.QueryRow(context.Background(), `SELECT done_count FROM gamification.daily_study_task dst
		JOIN gamification.daily_study_plan dsp ON dsp.id=dst.plan_id
		WHERE dsp.user_id=$1 AND dsp.plan_date=$2::date AND dst.task_type='bjt_quiz'`, userID, time.Now().Format("2006-01-02")).Scan(&quizProgress); err != nil {
		t.Fatalf("completion must persist daily quiz progress in its server transaction: %v", err)
	}
	if quizProgress != 1 {
		t.Fatalf("completion must record exactly one daily quiz task, got %d", quizProgress)
	}

	otherID := newUUID(t)
	seedActiveUser(t, db, otherID, "Other learner", fmt.Sprintf("quiz-other-%s@example.com", otherID[:8]), "")
	otherToken := createLearnerSession(t, sessions, otherID)
	private := quizRequest(t, router, otherToken, http.MethodGet, "/api/quiz/session/"+sessionID+"/question", "")
	if private.Code != http.StatusNotFound {
		t.Fatalf("other learner must not read session, got %d: %s", private.Code, private.Body.String())
	}
}

func TestQuizAnswerAfterExpiryReturnsPersistedResults(t *testing.T) {
	db := testPool(t)
	sessions := session.NewStore(db)
	router := NewRouter(Dependencies{Config: &config.Config{CORSOrigins: []string{"http://localhost:3000"}}, Logger: testLogger(), DBPool: db, SessionStore: sessions, StudyPlanStore: studyplan.NewStore(db)})
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Expired quiz", fmt.Sprintf("quiz-expired-%s@example.com", userID[:8]), "")
	rawToken := createLearnerSession(t, sessions, userID)
	templateID := seedQuizTemplate(t, db, 1)
	if _, err := db.Exec(context.Background(), `UPDATE assessment.bjt_mock_test SET time_limit_seconds=900 WHERE id=$1`, templateID); err != nil {
		t.Fatal(err)
	}
	started := quizRequest(t, router, rawToken, http.MethodPost, "/api/quiz/start", fmt.Sprintf(`{"templateId":%q}`, templateID))
	if started.Code != http.StatusCreated {
		t.Fatalf("start: want 201, got %d: %s", started.Code, started.Body.String())
	}
	var startData struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(started.Body.Bytes(), &startData); err != nil {
		t.Fatal(err)
	}
	questionRes := quizRequest(t, router, rawToken, http.MethodGet, "/api/quiz/session/"+startData.ID+"/question", "")
	if questionRes.Code != http.StatusOK {
		t.Fatalf("question: want 200, got %d: %s", questionRes.Code, questionRes.Body.String())
	}
	var questionData struct {
		Question struct {
			ID string `json:"id"`
		} `json:"question"`
	}
	if err := json.Unmarshal(questionRes.Body.Bytes(), &questionData); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(context.Background(), `UPDATE assessment.quiz_session SET started_at=NOW()-INTERVAL '901 seconds' WHERE id=$1`, startData.ID); err != nil {
		t.Fatal(err)
	}
	answer := quizRequest(t, router, rawToken, http.MethodPost, "/api/quiz/session/"+startData.ID+"/answer", fmt.Sprintf(`{"questionId":%q,"selectedOption":"A"}`, questionData.Question.ID))
	if answer.Code != http.StatusConflict || !bytes.Contains(answer.Body.Bytes(), []byte(`"error":"session expired"`)) {
		t.Fatalf("expired answer: want explicit 409 expiry, got %d: %s", answer.Code, answer.Body.String())
	}
	results := quizRequest(t, router, rawToken, http.MethodGet, "/api/quiz/session/"+startData.ID+"/results", "")
	if results.Code != http.StatusOK || !bytes.Contains(results.Body.Bytes(), []byte(`"status":"completed"`)) {
		t.Fatalf("expired session must expose its persisted result, got %d: %s", results.Code, results.Body.String())
	}
	var quizProgress int
	if err := db.QueryRow(context.Background(), `SELECT done_count FROM gamification.daily_study_task dst
		JOIN gamification.daily_study_plan dsp ON dsp.id=dst.plan_id
		WHERE dsp.user_id=$1 AND dsp.plan_date=$2::date AND dst.task_type='bjt_quiz'`, userID, time.Now().Format("2006-01-02")).Scan(&quizProgress); err != nil || quizProgress != 1 {
		t.Fatalf("expired completion must record one daily quiz task, got count=%d err=%v", quizProgress, err)
	}
}

func TestExpiredQuizQuestionReadRecordsStudyPlanProgress(t *testing.T) {
	db := testPool(t)
	sessions := session.NewStore(db)
	router := NewRouter(Dependencies{Config: &config.Config{CORSOrigins: []string{"http://localhost:3000"}}, Logger: testLogger(), DBPool: db, SessionStore: sessions, StudyPlanStore: studyplan.NewStore(db)})
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Expired question quiz", fmt.Sprintf("quiz-expired-read-%s@example.com", userID[:8]), "")
	token := createLearnerSession(t, sessions, userID)
	templateID := seedQuizTemplate(t, db, 1)
	if _, err := db.Exec(context.Background(), `UPDATE assessment.bjt_mock_test SET time_limit_seconds=900 WHERE id=$1`, templateID); err != nil {
		t.Fatal(err)
	}
	started := quizRequest(t, router, token, http.MethodPost, "/api/quiz/start", fmt.Sprintf(`{"templateId":%q}`, templateID))
	var startData struct {
		ID string `json:"id"`
	}
	if started.Code != http.StatusCreated || json.Unmarshal(started.Body.Bytes(), &startData) != nil {
		t.Fatalf("start quiz: %d %s", started.Code, started.Body.String())
	}
	if _, err := db.Exec(context.Background(), `UPDATE assessment.quiz_session SET started_at=NOW()-INTERVAL '901 seconds' WHERE id=$1`, startData.ID); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		question := quizRequest(t, router, token, http.MethodGet, "/api/quiz/session/"+startData.ID+"/question", "")
		if question.Code != http.StatusOK || !bytes.Contains(question.Body.Bytes(), []byte(`"status":"completed"`)) {
			t.Fatalf("expired question read must return a completed session: %d %s", question.Code, question.Body.String())
		}
	}
	var quizProgress int
	if err := db.QueryRow(context.Background(), `SELECT done_count FROM gamification.daily_study_task dst
		JOIN gamification.daily_study_plan dsp ON dsp.id=dst.plan_id
		WHERE dsp.user_id=$1 AND dsp.plan_date=$2::date AND dst.task_type='bjt_quiz'`, userID, time.Now().Format("2006-01-02")).Scan(&quizProgress); err != nil || quizProgress != 1 {
		t.Fatalf("expired question read must record completion exactly once, got count=%d err=%v", quizProgress, err)
	}
}

func TestQuizActiveSessionExpiresAndRecordsStudyPlanProgress(t *testing.T) {
	db := testPool(t)
	sessions := session.NewStore(db)
	router := NewRouter(Dependencies{Config: &config.Config{CORSOrigins: []string{"http://localhost:3000"}}, Logger: testLogger(), DBPool: db, SessionStore: sessions, StudyPlanStore: studyplan.NewStore(db)})
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Expired active quiz", fmt.Sprintf("quiz-expired-active-%s@example.com", userID[:8]), "")
	token := createLearnerSession(t, sessions, userID)
	templateID := seedQuizTemplate(t, db, 1)
	if _, err := db.Exec(context.Background(), `UPDATE assessment.bjt_mock_test SET time_limit_seconds=900 WHERE id=$1`, templateID); err != nil {
		t.Fatal(err)
	}
	started := quizRequest(t, router, token, http.MethodPost, "/api/quiz/start", fmt.Sprintf(`{"templateId":%q}`, templateID))
	var startData struct {
		ID string `json:"id"`
	}
	if started.Code != http.StatusCreated || json.Unmarshal(started.Body.Bytes(), &startData) != nil {
		t.Fatalf("start quiz: %d %s", started.Code, started.Body.String())
	}
	if _, err := db.Exec(context.Background(), `UPDATE assessment.quiz_session SET started_at=NOW()-INTERVAL '901 seconds' WHERE id=$1`, startData.ID); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		active := quizRequest(t, router, token, http.MethodGet, "/api/quiz/session/active", "")
		want := []byte(`"status":"completed"`)
		if i == 1 {
			want = []byte(`"session":null`)
		}
		if active.Code != http.StatusOK || !bytes.Contains(active.Body.Bytes(), want) {
			t.Fatalf("active lookup must finalize expired session for result recovery: %d %s", active.Code, active.Body.String())
		}
	}
	var progress int
	if err := db.QueryRow(context.Background(), `SELECT done_count FROM gamification.daily_study_task dst
		JOIN gamification.daily_study_plan dsp ON dsp.id=dst.plan_id
		WHERE dsp.user_id=$1 AND dsp.plan_date=$2::date AND dst.task_type='bjt_quiz'`, userID, time.Now().Format("2006-01-02")).Scan(&progress); err != nil || progress != 1 {
		t.Fatalf("active lookup must record expired completion exactly once, got count=%d err=%v", progress, err)
	}
}

func TestQuizQuestionRejectsAbandonedSession(t *testing.T) {
	db := testPool(t)
	sessions := session.NewStore(db)
	router := NewRouter(Dependencies{Config: &config.Config{CORSOrigins: []string{"http://localhost:3000"}}, Logger: testLogger(), DBPool: db, SessionStore: sessions, StudyPlanStore: studyplan.NewStore(db)})
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Abandoned quiz", fmt.Sprintf("quiz-abandoned-%s@example.com", userID[:8]), "")
	token := createLearnerSession(t, sessions, userID)
	templateID := seedQuizTemplate(t, db, 1)
	started := quizRequest(t, router, token, http.MethodPost, "/api/quiz/start", fmt.Sprintf(`{"templateId":%q}`, templateID))
	var startData struct {
		ID string `json:"id"`
	}
	if started.Code != http.StatusCreated || json.Unmarshal(started.Body.Bytes(), &startData) != nil {
		t.Fatalf("start quiz: %d %s", started.Code, started.Body.String())
	}
	if _, err := db.Exec(context.Background(), `UPDATE assessment.quiz_session SET status='abandoned' WHERE id=$1`, startData.ID); err != nil {
		t.Fatal(err)
	}
	question := quizRequest(t, router, token, http.MethodGet, "/api/quiz/session/"+startData.ID+"/question", "")
	if question.Code != http.StatusConflict || bytes.Contains(question.Body.Bytes(), []byte(`"question"`)) {
		t.Fatalf("abandoned session must reject question content, got %d %s", question.Code, question.Body.String())
	}
}

func TestStudyGoalReportsWhetherLearnerHasSetGoal(t *testing.T) {
	db := testPool(t)
	sessions := session.NewStore(db)
	router := NewRouter(Dependencies{Config: &config.Config{CORSOrigins: []string{"http://localhost:3000"}}, Logger: testLogger(), DBPool: db, SessionStore: sessions})
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Study goal", fmt.Sprintf("study-goal-%s@example.com", userID[:8]), "")
	token := createLearnerSession(t, sessions, userID)
	if unauthenticated := quizRequest(t, router, "", http.MethodGet, "/api/gamification/study-goal", ""); unauthenticated.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous goal read must return 401, got %d %s", unauthenticated.Code, unauthenticated.Body.String())
	}
	if unauthenticated := quizRequest(t, router, "", http.MethodPost, "/api/gamification/study-goal", `{"targetMinutes":10}`); unauthenticated.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous goal write must return 401, got %d %s", unauthenticated.Code, unauthenticated.Body.String())
	}
	goal := quizRequest(t, router, token, http.MethodGet, "/api/gamification/study-goal", "")
	if goal.Code != http.StatusOK || !bytes.Contains(goal.Body.Bytes(), []byte(`"targetMinutes":15`)) || !bytes.Contains(goal.Body.Bytes(), []byte(`"isSet":false`)) {
		t.Fatalf("unset goal must return the default and isSet=false, got %d %s", goal.Code, goal.Body.String())
	}
	set := quizRequest(t, router, token, http.MethodPost, "/api/gamification/study-goal", `{"targetMinutes":10}`)
	if set.Code != http.StatusOK || !bytes.Contains(set.Body.Bytes(), []byte(`"targetMinutes":10`)) {
		t.Fatalf("set goal: %d %s", set.Code, set.Body.String())
	}
	goal = quizRequest(t, router, token, http.MethodGet, "/api/gamification/study-goal", "")
	if goal.Code != http.StatusOK || !bytes.Contains(goal.Body.Bytes(), []byte(`"targetMinutes":10`)) || !bytes.Contains(goal.Body.Bytes(), []byte(`"isSet":true`)) {
		t.Fatalf("saved goal must return isSet=true, got %d %s", goal.Code, goal.Body.String())
	}
}

func TestOfficialQuizStatusUsesCanonicalEntitlement(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	var previousEnabled, previousKillSwitch bool
	if err := db.QueryRow(ctx, `SELECT enabled,kill_switch FROM ops.feature_flag WHERE key='quiz.official_simulation.enabled'`).Scan(&previousEnabled, &previousKillSwitch); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `UPDATE ops.feature_flag SET enabled=$1,kill_switch=$2 WHERE key='quiz.official_simulation.enabled'`, previousEnabled, previousKillSwitch)
	})
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Official quiz learner", fmt.Sprintf("quiz-official-%s@example.com", userID[:8]), "")
	planID := newUUID(t)
	planSlug := "quiz-official-" + planID[:8]
	seedPricingPlan(t, db, planID, planSlug)
	var entitlementID string
	if err := db.QueryRow(ctx, `INSERT INTO monetization.entitlement_definition(key) VALUES('quiz.official_simulation')
		ON CONFLICT(key) DO UPDATE SET key=EXCLUDED.key RETURNING id`).Scan(&entitlementID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO monetization.plan_entitlement(plan_id,entitlement_id) VALUES($1,$2)`, planID, entitlementID); err != nil {
		t.Fatal(err)
	}
	subscriptionID := newUUID(t)
	if _, err := db.Exec(ctx, `INSERT INTO monetization.user_subscription(id,user_id,plan_id,status,updated_at) VALUES($1,$2,$3,'active',NOW())`, subscriptionID, userID, planID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM monetization.user_subscription WHERE id=$1`, subscriptionID) })

	templateID := seedQuizTemplate(t, db, 1)
	if _, err := db.Exec(ctx, `UPDATE assessment.bjt_mock_test SET type='official',time_limit_seconds=2700 WHERE id=$1`, templateID); err != nil {
		t.Fatal(err)
	}
	sessions := session.NewStore(db)
	router := NewRouter(Dependencies{Config: &config.Config{CORSOrigins: []string{"http://localhost:3000"}}, Logger: testLogger(), DBPool: db, SessionStore: sessions})
	token := createLearnerSession(t, sessions, userID)
	statusResponse := quizRequest(t, router, token, http.MethodGet, "/api/quiz/official-simulation/status", "")
	var status officialQuizStatus
	if statusResponse.Code != http.StatusOK || json.Unmarshal(statusResponse.Body.Bytes(), &status) != nil {
		t.Fatalf("official status: want 200, got %d: %s", statusResponse.Code, statusResponse.Body.String())
	}
	if status.EntitlementKey != "quiz.official_simulation" || !status.Enabled || !status.Entitled || status.PlanSlug != planSlug {
		t.Fatalf("official entitlement should match the canonical subscription feature, got %#v", status)
	}
	started := quizRequest(t, router, token, http.MethodPost, "/api/quiz/start", fmt.Sprintf(`{"templateId":%q}`, templateID))
	var startData struct {
		ID string `json:"id"`
	}
	if started.Code != http.StatusCreated || json.Unmarshal(started.Body.Bytes(), &startData) != nil {
		t.Fatalf("entitled learner should start an official simulation, got %d: %s", started.Code, started.Body.String())
	}
	question := quizRequest(t, router, token, http.MethodGet, "/api/quiz/session/"+startData.ID+"/question", "")
	var questionData struct {
		Question struct {
			ID string `json:"id"`
		} `json:"question"`
	}
	if question.Code != http.StatusOK || json.Unmarshal(question.Body.Bytes(), &questionData) != nil || questionData.Question.ID == "" {
		t.Fatalf("entitled learner should load official question, got %d: %s", question.Code, question.Body.String())
	}
	if _, err := db.Exec(ctx, `DELETE FROM monetization.user_subscription WHERE id=$1`, subscriptionID); err != nil {
		t.Fatal(err)
	}
	question = quizRequest(t, router, token, http.MethodGet, "/api/quiz/session/"+startData.ID+"/question", "")
	if question.Code != http.StatusForbidden || bytes.Contains(question.Body.Bytes(), []byte(`"question"`)) {
		t.Fatalf("revoked official entitlement must not expose question content, got %d %s", question.Code, question.Body.String())
	}
	answer := quizRequest(t, router, token, http.MethodPost, "/api/quiz/session/"+startData.ID+"/answer", fmt.Sprintf(`{"questionId":%q,"selectedOption":"A"}`, questionData.Question.ID))
	if answer.Code != http.StatusForbidden {
		t.Fatalf("revoked official entitlement must reject answers, got %d %s", answer.Code, answer.Body.String())
	}
	if _, err := db.Exec(ctx, `INSERT INTO monetization.user_subscription(id,user_id,plan_id,status,updated_at)
		VALUES($1,$2,$3,'active',NOW()) ON CONFLICT(id) DO UPDATE SET status='active',updated_at=NOW()`, subscriptionID, userID, planID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `UPDATE ops.feature_flag SET enabled=false WHERE key='quiz.official_simulation.enabled'`); err != nil {
		t.Fatal(err)
	}
	question = quizRequest(t, router, token, http.MethodGet, "/api/quiz/session/"+startData.ID+"/question", "")
	if question.Code != http.StatusForbidden || bytes.Contains(question.Body.Bytes(), []byte(`"question"`)) {
		t.Fatalf("disabled official-simulation flag must hide question content, got %d %s", question.Code, question.Body.String())
	}
	answer = quizRequest(t, router, token, http.MethodPost, "/api/quiz/session/"+startData.ID+"/answer", fmt.Sprintf(`{"questionId":%q,"selectedOption":"A"}`, questionData.Question.ID))
	if answer.Code != http.StatusForbidden {
		t.Fatalf("disabled official-simulation flag must reject answers, got %d %s", answer.Code, answer.Body.String())
	}
	if _, err := db.Exec(ctx, `UPDATE ops.feature_flag SET enabled=true WHERE key='quiz.official_simulation.enabled'`); err != nil {
		t.Fatal(err)
	}
	answer = quizRequest(t, router, token, http.MethodPost, "/api/quiz/session/"+startData.ID+"/answer", fmt.Sprintf(`{"questionId":%q,"selectedOption":"A"}`, questionData.Question.ID))
	if answer.Code != http.StatusCreated {
		t.Fatalf("restored official access should complete the fixture session, got %d %s", answer.Code, answer.Body.String())
	}
	if _, err := db.Exec(ctx, `UPDATE ops.feature_flag SET enabled=false WHERE key='quiz.official_simulation.enabled'`); err != nil {
		t.Fatal(err)
	}
	breakdown := quizRequest(t, router, token, http.MethodGet, "/api/quiz/session/"+startData.ID+"/results/breakdown", "")
	if breakdown.Code != http.StatusForbidden || bytes.Contains(breakdown.Body.Bytes(), []byte(`"prompt"`)) || bytes.Contains(breakdown.Body.Bytes(), []byte(`"explanationVi"`)) {
		t.Fatalf("disabled official-simulation flag must hide completed question explanations, got %d %s", breakdown.Code, breakdown.Body.String())
	}
}

func TestQuizStart_MissingTemplateID(t *testing.T) {
	db := testPool(t)
	sessions := session.NewStore(db)
	router := NewRouter(Dependencies{Config: &config.Config{CORSOrigins: []string{"http://localhost:3000"}}, Logger: testLogger(), DBPool: db, SessionStore: sessions})
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Quiz empty", fmt.Sprintf("quiz-empty-%s@example.com", userID[:8]), "")
	rawToken := createLearnerSession(t, sessions, userID)
	response := quizRequest(t, router, rawToken, http.MethodPost, "/api/quiz/start", `{}`)
	if response.Code != http.StatusBadRequest {
		t.Fatalf("missing template should return 400, got %d: %s", response.Code, response.Body.String())
	}
}

func TestQuizSessionRoutesRequireAuthentication(t *testing.T) {
	db := testPool(t)
	router := NewRouter(Dependencies{Config: &config.Config{CORSOrigins: []string{"http://localhost:3000"}}, Logger: testLogger(), DBPool: db, SessionStore: session.NewStore(db)})
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/quiz/session/history", nil)
	router.ServeHTTP(response, request)
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous history should return 401, got %d: %s", response.Code, response.Body.String())
	}
}

func TestQuizTemplateListReturnsCardMetadata(t *testing.T) {
	db := testPool(t)
	templateID := seedQuizTemplate(t, db, 1)
	if _, err := db.Exec(context.Background(), `UPDATE assessment.bjt_mock_test
		SET title_vi='Localized practice title',title_ja='日本語の練習',level='BJT-J2',time_limit_seconds=900
		WHERE id=$1`, templateID); err != nil {
		t.Fatal(err)
	}
	router := NewRouter(Dependencies{Config: &config.Config{CORSOrigins: []string{"http://localhost:3000"}}, Logger: testLogger(), DBPool: db, QuizTemplateStore: quiztemplate.NewStore(db)})
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/quiz/templates", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("list templates: want 200, got %d: %s", response.Code, response.Body.String())
	}
	var templates []map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &templates); err != nil {
		t.Fatal(err)
	}
	for _, item := range templates {
		if item["id"] != templateID {
			continue
		}
		if item["titleVi"] != "Localized practice title" || item["titleJa"] != "日本語の練習" || item["sectionCount"] != float64(1) || item["timeLimitSeconds"] != float64(900) {
			t.Fatalf("template card metadata mismatch: %#v", item)
		}
		return
	}
	t.Fatalf("published fixture absent from template list: %s", response.Body.String())
}

func TestQuizTemplateListExcludesTemplatesWithoutPublishedQuestions(t *testing.T) {
	db := testPool(t)
	emptyTemplateID := seedQuizTemplate(t, db, 0)
	router := NewRouter(Dependencies{Config: &config.Config{CORSOrigins: []string{"http://localhost:3000"}}, Logger: testLogger(), DBPool: db, QuizTemplateStore: quiztemplate.NewStore(db)})
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/quiz/templates", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("list templates: want 200, got %d: %s", response.Code, response.Body.String())
	}
	var templates []map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &templates); err != nil {
		t.Fatal(err)
	}
	for _, item := range templates {
		if item["id"] == emptyTemplateID {
			t.Fatalf("non-playable published template must not appear in learner list: %s", response.Body.String())
		}
	}
}

func TestQuizSessionRemainingSecondsUsesSecondUnits(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Quiz timer", fmt.Sprintf("quiz-timer-%s@example.com", userID[:8]), "")
	templateID := seedQuizTemplate(t, db, 1)
	if _, err := db.Exec(ctx, `UPDATE assessment.bjt_mock_test SET time_limit_seconds=900 WHERE id=$1`, templateID); err != nil {
		t.Fatal(err)
	}
	var sessionID string
	if err := db.QueryRow(ctx, `INSERT INTO assessment.quiz_session(user_id,test_id,total_questions,started_at)
		VALUES($1,$2,1,NOW()-INTERVAL '5 seconds') RETURNING id`, userID, templateID).Scan(&sessionID); err != nil {
		t.Fatal(err)
	}
	view, err := loadQuizSession(ctx, db, sessionID, userID)
	if err != nil {
		t.Fatal(err)
	}
	if view.RemainingSeconds == nil || *view.RemainingSeconds <= 0 || *view.RemainingSeconds > 900 {
		got := -1
		if view.RemainingSeconds != nil {
			got = *view.RemainingSeconds
		}
		t.Fatalf("remaining quiz seconds must be within the 900-second limit, got %d", got)
	}
}

func quizRequest(t *testing.T, router http.Handler, token, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	request := httptest.NewRequest(method, path, bytes.NewBufferString(body))
	request.Header.Set("Origin", "http://localhost:3000")
	request.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
	if method == http.MethodPost {
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("X-CSRF-Token", "test-csrf")
	}
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}

func seedQuizTemplate(t *testing.T, db *pgxpool.Pool, questionCount int) string {
	t.Helper()
	ctx := context.Background()
	testID := newUUID(t)
	_, err := db.Exec(ctx, `INSERT INTO assessment.bjt_mock_test(id,slug,title_vi,type,status,time_limit_seconds,created_at,updated_at)
		VALUES($1,$2,'Disposable quiz test','practice','published',NULL,NOW(),NOW())`, testID, "quiz-test-"+testID)
	if err != nil {
		t.Fatal(err)
	}
	sectionID := newUUID(t)
	if _, err := db.Exec(ctx, `INSERT INTO assessment.bjt_test_section(id,test_id,code,title_vi,display_order,created_at)
		VALUES($1,$2,'S1','Part 1',1,NOW())`, sectionID, testID); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < questionCount; i++ {
		questionID := newUUID(t)
		if _, err := db.Exec(ctx, `INSERT INTO assessment.bjt_question(id,section_id,prompt,explanation_vi,skill_tag,status,created_at,updated_at)
			VALUES($1,$2,$3,'Answer explanation','business','published',NOW(),NOW())`, questionID, sectionID, fmt.Sprintf("Question %d", i+1)); err != nil {
			t.Fatal(err)
		}
		if _, err := db.Exec(ctx, `INSERT INTO assessment.bjt_question_option(question_id,option_key,text,is_correct,created_at)
			VALUES($1,'A','Correct answer',true,NOW()),($1,'B','Incorrect answer',false,NOW())`, questionID); err != nil {
			t.Fatal(err)
		}
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM assessment.quiz_session WHERE test_id=$1`, testID)
		_, _ = db.Exec(ctx, `DELETE FROM assessment.bjt_mock_test WHERE id=$1`, testID)
	})
	return testID
}
