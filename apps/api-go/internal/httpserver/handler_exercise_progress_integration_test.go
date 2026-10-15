package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func TestExercisesDailyProgressReturnsCanonicalGoalAndCompletion(t *testing.T) {
	db := testPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Practice learner", fmt.Sprintf("%s@example.test", userID), "exercise-progress-"+userID)
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM exercise.exercise_answer WHERE session_id IN (SELECT id FROM exercise.exercise_session WHERE user_id = $1)`, userID)
		_, _ = db.Exec(context.Background(), `DELETE FROM exercise.exercise_session WHERE user_id = $1`, userID)
		_, _ = db.Exec(context.Background(), `DELETE FROM auth.session WHERE user_id = $1`, userID)
		_, _ = db.Exec(context.Background(), `DELETE FROM profile.user_profile WHERE id = $1`, userID)
	})
	if _, err := db.Exec(ctx, `UPDATE profile.user_profile SET daily_goal_exercises = 4 WHERE id = $1`, userID); err != nil {
		t.Fatalf("set learner goal: %v", err)
	}
	for _, questions := range []int{2, 1} {
		var sessionID string
		if err := db.QueryRow(ctx, `INSERT INTO exercise.exercise_session
			(user_id, session_type, exercise_type, status, total_questions, correct_count, score, completed_at)
			VALUES ($1, 'practice_tab', 'meaning_match', 'completed', $2, 1, 10, NOW()) RETURNING id`, userID, questions).Scan(&sessionID); err != nil {
			t.Fatalf("create completed practice session: %v", err)
		}
	}

	store := session.NewStore(db)
	token, err := store.CreateLearnerSession(ctx, userID, "integration-test", "127.0.0.1", time.Now().Add(time.Hour))
	if err != nil {
		t.Fatalf("create learner session: %v", err)
	}
	handler := authn.LearnerGuard(store, authn.DefaultGuardConfig(nil))(
		getExercisesDailyProgressHandler(db, nil),
	)
	request := httptest.NewRequest(http.MethodGet, "/api/exercises/daily-progress", nil)
	request.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("daily progress status = %d: %s", response.Code, response.Body.String())
	}
	var progress struct {
		Completed      int     `json:"completed"`
		Goal           int     `json:"goal"`
		Progress       float64 `json:"progress"`
		IsComplete     bool    `json:"isComplete"`
		SessionCount   int     `json:"sessionCount"`
		TotalQuestions int     `json:"totalQuestions"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &progress); err != nil {
		t.Fatalf("decode daily progress: %v", err)
	}
	if progress.Completed != 3 || progress.Goal != 4 || progress.Progress != 0.75 || progress.IsComplete || progress.SessionCount != 2 || progress.TotalQuestions != 3 {
		t.Fatalf("daily progress = %+v; want 3/4 (0.75), incomplete, two sessions", progress)
	}
	if _, err := db.Exec(ctx, `UPDATE profile.user_profile SET daily_goal_exercises = 3 WHERE id = $1`, userID); err != nil {
		t.Fatalf("set completed learner goal: %v", err)
	}
	request = httptest.NewRequest(http.MethodGet, "/api/exercises/daily-progress", nil)
	request.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if err := json.Unmarshal(response.Body.Bytes(), &progress); err != nil {
		t.Fatalf("decode completed daily progress: %v", err)
	}
	if progress.Completed != progress.Goal || progress.Progress != 1 || !progress.IsComplete {
		t.Fatalf("completed daily progress = %+v; want goal reached", progress)
	}
}

func TestExercisesDailyProgressUsesLearnerTimezoneBoundaries(t *testing.T) {
	db := testPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Timezone learner", fmt.Sprintf("%s@example.test", userID), "exercise-timezone-"+userID)
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM exercise.exercise_session WHERE user_id = $1`, userID)
		_, _ = db.Exec(context.Background(), `DELETE FROM auth.session WHERE user_id = $1`, userID)
		_, _ = db.Exec(context.Background(), `DELETE FROM profile.user_profile WHERE id = $1`, userID)
	})

	appNow := time.Now()
	appDate := appNow.Format("2006-01-02")
	var timezone string
	var location *time.Location
	var dayStart, dayEnd time.Time
	for _, candidate := range []string{"Pacific/Kiritimati", "Etc/GMT+12"} {
		candidateLocation, err := time.LoadLocation(candidate)
		if err != nil {
			t.Fatalf("load test timezone %q: %v", candidate, err)
		}
		localNow := appNow.In(candidateLocation)
		start := time.Date(localNow.Year(), localNow.Month(), localNow.Day(), 0, 0, 0, 0, candidateLocation)
		end := start.AddDate(0, 0, 1)
		if localNow.Format("2006-01-02") != appDate &&
			(start.Add(time.Second).UTC().Format("2006-01-02") != appDate || end.Add(-time.Second).UTC().Format("2006-01-02") != appDate) {
			timezone, location, dayStart, dayEnd = candidate, candidateLocation, start, end
			break
		}
	}
	if location == nil {
		t.Fatalf("no test timezone has a local day boundary outside the app date %s", appDate)
	}
	if _, err := db.Exec(ctx, `UPDATE profile.user_profile SET timezone = $2, daily_goal_exercises = 10 WHERE id = $1`, userID, timezone); err != nil {
		t.Fatalf("set learner timezone and goal: %v", err)
	}
	for _, fixture := range []struct {
		completedAt time.Time
		questions   int
	}{
		{dayStart.Add(-time.Second), 20},
		{dayStart.Add(time.Second), 2},
		{dayEnd.Add(-time.Second), 3},
		{dayEnd, 30},
	} {
		if _, err := db.Exec(ctx, `INSERT INTO exercise.exercise_session
			(user_id, session_type, exercise_type, status, total_questions, correct_count, score, completed_at)
			VALUES ($1, 'practice_tab', 'meaning_match', 'completed', $2, 1, $3, $4)`,
			userID, fixture.questions, fixture.questions*10, fixture.completedAt); err != nil {
			t.Fatalf("create timezone boundary session: %v", err)
		}
	}

	store := session.NewStore(db)
	token, err := store.CreateLearnerSession(ctx, userID, "integration-test", "127.0.0.1", time.Now().Add(time.Hour))
	if err != nil {
		t.Fatalf("create learner session: %v", err)
	}
	handler := authn.LearnerGuard(store, authn.DefaultGuardConfig(nil))(
		getExercisesDailyProgressHandler(db, testLogger()),
	)
	request := httptest.NewRequest(http.MethodGet, "/api/exercises/daily-progress", nil)
	request.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("daily progress status = %d: %s", response.Code, response.Body.String())
	}
	var progress struct {
		Date           string  `json:"date"`
		Completed      int     `json:"completed"`
		Goal           int     `json:"goal"`
		Progress       float64 `json:"progress"`
		IsComplete     bool    `json:"isComplete"`
		SessionCount   int     `json:"sessionCount"`
		TotalQuestions int     `json:"totalQuestions"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &progress); err != nil {
		t.Fatalf("decode timezone daily progress: %v", err)
	}
	wantDate := time.Now().In(location).Format("2006-01-02")
	if progress.Date != wantDate || progress.Completed != 5 || progress.Goal != 10 || progress.Progress != 0.5 || progress.IsComplete || progress.SessionCount != 2 || progress.TotalQuestions != 5 {
		t.Fatalf("daily progress = %+v; want local date %s, 5/10 across two sessions", progress, wantDate)
	}
}

func TestExercisesDailyProgressInvalidTimezoneFallsBackToUTC(t *testing.T) {
	db := testPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Fallback learner", fmt.Sprintf("%s@example.test", userID), "exercise-timezone-fallback-"+userID)
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM exercise.exercise_session WHERE user_id = $1`, userID)
		_, _ = db.Exec(context.Background(), `DELETE FROM auth.session WHERE user_id = $1`, userID)
		_, _ = db.Exec(context.Background(), `DELETE FROM profile.user_profile WHERE id = $1`, userID)
	})

	originalLocal := time.Local
	appNow := time.Now()
	localOffset := 23 * time.Hour
	if appNow.In(time.FixedZone("test local", int(localOffset.Seconds()))).Format("2006-01-02") == appNow.UTC().Format("2006-01-02") {
		localOffset = -23 * time.Hour
	}
	time.Local = time.FixedZone("test local", int(localOffset.Seconds()))
	defer func() { time.Local = originalLocal }()
	nowUTC := time.Now().UTC()
	completion := time.Date(nowUTC.Year(), nowUTC.Month(), nowUTC.Day(), 12, 0, 0, 0, time.UTC)
	if _, err := db.Exec(ctx, `UPDATE profile.user_profile SET timezone = 'Invalid/Zone', daily_goal_exercises = 4 WHERE id = $1`, userID); err != nil {
		t.Fatalf("set invalid learner timezone: %v", err)
	}
	for _, questions := range []int{1, 2} {
		if _, err := db.Exec(ctx, `INSERT INTO exercise.exercise_session
			(user_id, session_type, exercise_type, status, total_questions, correct_count, score, completed_at)
			VALUES ($1, 'practice_tab', 'meaning_match', 'completed', $2, 1, $3, $4)`,
			userID, questions, questions*10, completion); err != nil {
			t.Fatalf("create UTC fallback session: %v", err)
		}
	}

	store := session.NewStore(db)
	token, err := store.CreateLearnerSession(ctx, userID, "integration-test", "127.0.0.1", time.Now().Add(time.Hour))
	if err != nil {
		t.Fatalf("create learner session: %v", err)
	}
	handler := authn.LearnerGuard(store, authn.DefaultGuardConfig(nil))(
		getExercisesDailyProgressHandler(db, testLogger()),
	)
	request := httptest.NewRequest(http.MethodGet, "/api/exercises/daily-progress", nil)
	request.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("daily progress status = %d: %s", response.Code, response.Body.String())
	}
	var progress struct {
		Date           string `json:"date"`
		Completed      int    `json:"completed"`
		SessionCount   int    `json:"sessionCount"`
		TotalQuestions int    `json:"totalQuestions"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &progress); err != nil {
		t.Fatalf("decode UTC fallback progress: %v", err)
	}
	wantDate := time.Now().UTC().Format("2006-01-02")
	if progress.Date != wantDate || progress.Completed != 3 || progress.SessionCount != 2 || progress.TotalQuestions != 3 {
		t.Fatalf("daily progress = %+v; want UTC date %s with 3 questions in two sessions", progress, wantDate)
	}
}
