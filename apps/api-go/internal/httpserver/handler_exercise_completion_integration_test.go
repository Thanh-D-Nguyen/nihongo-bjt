package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func TestExerciseCompletionFeedsCanonicalProgress(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	userID, exerciseID, sessionID, configID := newUUID(t), newUUID(t), newUUID(t), newUUID(t)
	seedActiveUser(t, db, userID, "Exercise progress", fmt.Sprintf("%s@example.test", userID), "")
	if _, err := db.Exec(ctx, `UPDATE profile.user_profile SET timezone = 'UTC' WHERE id = $1`, userID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM learning.study_session WHERE user_id = $1`, userID)
		_, _ = db.Exec(ctx, `DELETE FROM exercise.exercise_answer WHERE session_id = $1`, sessionID)
		_, _ = db.Exec(ctx, `DELETE FROM exercise.exercise_session WHERE id = $1`, sessionID)
		_, _ = db.Exec(ctx, `DELETE FROM exercise.exercise WHERE id = $1`, exerciseID)
		_, _ = db.Exec(ctx, `DELETE FROM gamification.streak_config WHERE id = $1`, configID)
		_, _ = db.Exec(ctx, `DELETE FROM auth.session WHERE user_id = $1`, userID)
		_, _ = db.Exec(ctx, `DELETE FROM profile.user_profile WHERE id = $1`, userID)
	})
	for _, fixture := range []struct {
		sql  string
		args []any
	}{
		{`INSERT INTO exercise.exercise (id, exercise_type, source_type, source_id, prompt, choices, correct_answer) VALUES ($1, 'meaning_match', 'lexeme', $2, '{}', '[]', '{"key":"A"}')`, []any{exerciseID, userID}},
		{`INSERT INTO exercise.exercise_session (id, user_id, session_type, exercise_type, status, exercise_ids) VALUES ($1, $2, 'practice_tab', 'meaning_match', 'in_progress', ARRAY[$3::uuid])`, []any{sessionID, userID, exerciseID}},
		{`INSERT INTO exercise.exercise_answer (session_id, exercise_id, user_answer, is_correct, time_spent_ms) VALUES ($1, $2, '{"key":"A"}', true, 120000)`, []any{sessionID, exerciseID}},
		{`INSERT INTO gamification.streak_config (id, name, activity_type, updated_at) VALUES ($1, 'Exercise regression', 'exercise', NOW())`, []any{configID}},
		{`INSERT INTO gamification.user_streak (user_id, streak_config_id, current_streak, longest_streak, last_activity_date, updated_at) VALUES ($1, $2, 2, 5, CURRENT_DATE - 1, NOW())`, []any{userID, configID}},
	} {
		if _, err := db.Exec(ctx, fixture.sql, fixture.args...); err != nil {
			t.Fatal(err)
		}
	}
	sessions := session.NewStore(db)
	token := createLearnerSession(t, sessions, userID)
	router := NewRouter(Dependencies{Config: &config.Config{CORSOrigins: []string{"http://localhost:3000"}}, Logger: testLogger(), DBPool: db, SessionStore: sessions})
	request := func(method, path string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, nil)
		req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
		req.Header.Set("Origin", "http://localhost:3000")
		req.Header.Set("X-CSRF-Token", "test-csrf")
		response := httptest.NewRecorder()
		router.ServeHTTP(response, req)
		if response.Code != http.StatusOK {
			t.Fatalf("%s: %d %s", path, response.Code, response.Body.String())
		}
		return response
	}
	request(http.MethodPost, "/api/exercises/sessions/"+sessionID+"/complete")
	response := request(http.MethodGet, "/api/analytics/learner?days=7")
	var progress struct {
		DailyStats []struct{ Minutes, LessonsCount int }
		Totals     struct {
			CompletedSessions, CompletedExerciseSessions, ExerciseAnswerCount, StreakDays int
			ExerciseAccuracyPct                                                           float64
			CompletedBjtSessions, ReviewCount                                             int
		}
	}
	if err := json.Unmarshal(response.Body.Bytes(), &progress); err != nil {
		t.Fatal(err)
	}
	if progress.Totals.CompletedSessions != 1 || progress.Totals.CompletedExerciseSessions != 1 || progress.Totals.ExerciseAnswerCount != 1 || progress.Totals.ExerciseAccuracyPct != 100 || progress.Totals.StreakDays != 3 {
		t.Fatalf("exercise completion missing from canonical progress: %+v", progress)
	}
	if progress.Totals.CompletedBjtSessions != 0 || progress.Totals.ReviewCount != 0 {
		t.Fatalf("exercise must not be mislabeled as BJT or SRS: %+v", progress.Totals)
	}
	if len(progress.DailyStats) != 1 || progress.DailyStats[0].Minutes != 2 || progress.DailyStats[0].LessonsCount != 1 {
		t.Fatalf("exercise missing from daily activity: %+v", progress.DailyStats)
	}
	request(http.MethodPost, "/api/exercises/sessions/"+sessionID+"/complete")
	var activities, streak int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM learning.study_session WHERE user_id = $1`, userID).Scan(&activities); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `SELECT current_streak FROM gamification.user_streak WHERE user_id = $1 AND streak_config_id = $2`, userID, configID).Scan(&streak); err != nil {
		t.Fatal(err)
	}
	if activities != 1 || streak != 3 {
		t.Fatalf("retry duplicated activity/streak: %d / %d", activities, streak)
	}
}

func TestExerciseGlossUsesCompleteSense(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	id := newUUID(t)
	if _, err := db.Exec(ctx, `INSERT INTO content.lexeme (id, headword, short_meaning_vi, jlpt_level, created_at, updated_at) VALUES ($1, '葬儀屋', 'người nhận làm có', 'N5', NOW(), NOW())`, id); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM content.lexeme WHERE id = $1`, id) })
	if _, err := db.Exec(ctx, `INSERT INTO content.lexeme_sense (lexeme_id, position, meaning_vi) VALUES ($1, 1, 'người tổ chức tang lễ; dịch vụ mai táng; nghĩa thứ ba')`, id); err != nil {
		t.Fatal(err)
	}
	lexemes, err := selectExerciseLexemes(ctx, db, "N5", 10000)
	if err != nil {
		t.Fatal(err)
	}
	for _, lexeme := range lexemes {
		if lexeme.ID == id {
			if lexeme.Meaning != "người tổ chức tang lễ; dịch vụ mai táng" {
				t.Fatalf("exercise gloss must use complete primary senses: %q", lexeme.Meaning)
			}
			return
		}
	}
	t.Fatal("fixture lexeme missing")
}
