package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func TestWeeklyReportLatestIsAuthenticatedAndUsesLatestLearnerRow(t *testing.T) {
	db := testPool(t)
	userID, otherUserID := newUUID(t), newUUID(t)
	seedActiveUser(t, db, userID, "Weekly Report Learner", "weekly-report-"+userID[:8]+"@example.com", "")
	seedActiveUser(t, db, otherUserID, "Other Weekly Report Learner", "weekly-report-"+otherUserID[:8]+"@example.com", "")
	_, err := db.Exec(context.Background(), `
		INSERT INTO analytics.weekly_report
			(user_id, week_start, week_end, total_reviews, accuracy_pct, streak_days, quiz_sessions, new_cards_learned, weak_skills, prev_week_reviews, prev_week_accuracy)
		VALUES
			($1, CURRENT_DATE - 14, CURRENT_DATE - 8, 4, 50, 2, 1, 3, ARRAY['grammar'], 8, 75),
			($1, CURRENT_DATE - 7, CURRENT_DATE - 1, 11, 81.5, 5, 3, 7, ARRAY['listening','kanji'], 4, 50),
			($2, CURRENT_DATE - 7, CURRENT_DATE - 1, 99, 99, 9, 9, 9, ARRAY['other'], 99, 99)`, userID, otherUserID)
	if err != nil {
		t.Fatalf("seed weekly reports: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM analytics.weekly_report WHERE user_id IN ($1, $2)`, userID, otherUserID)
	})

	sessions := session.NewStore(db)
	rawToken := createLearnerSession(t, sessions, userID)
	router := NewRouter(Dependencies{Config: &config.Config{}, Logger: testLogger(), DBPool: db, SessionStore: sessions})
	request := func(token string, query string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, "/api/analytics/weekly-report/latest"+query, nil)
		if token != "" {
			req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
		}
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		return w
	}

	if got := request("", ""); got.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous request should be unauthorized, got %d: %s", got.Code, got.Body.String())
	}
	w := request(rawToken, "?userId="+otherUserID)
	if w.Code != http.StatusOK {
		t.Fatalf("authenticated request should succeed, got %d: %s", w.Code, w.Body.String())
	}
	var body struct {
		TotalReviews     int      `json:"totalReviews"`
		AccuracyPct      float64  `json:"accuracyPct"`
		StreakDays       int      `json:"streakDays"`
		QuizSessions     int      `json:"quizSessions"`
		NewCardsLearned  int      `json:"newCardsLearned"`
		WeakSkills       []string `json:"weakSkills"`
		PrevWeekReviews  *int     `json:"prevWeekReviews"`
		PrevWeekAccuracy *float64 `json:"prevWeekAccuracy"`
		WeekStart        string   `json:"weekStart"`
		WeekEnd          string   `json:"weekEnd"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode weekly report: %v", err)
	}
	if body.TotalReviews != 11 || body.AccuracyPct != 81.5 || body.StreakDays != 5 || body.QuizSessions != 3 || body.NewCardsLearned != 7 || len(body.WeakSkills) != 2 || body.PrevWeekReviews == nil || *body.PrevWeekReviews != 4 || body.PrevWeekAccuracy == nil || *body.PrevWeekAccuracy != 50 || body.WeekStart == "" || body.WeekEnd == "" {
		t.Fatalf("expected latest report for authenticated learner, got %+v", body)
	}
}

func TestWeeklyReportLatestReturnsNullWhenNoReportExists(t *testing.T) {
	db := testPool(t)
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Empty Weekly Report Learner", "weekly-report-empty-"+userID[:8]+"@example.com", "")
	sessions := session.NewStore(db)
	rawToken := createLearnerSession(t, sessions, userID)
	router := NewRouter(Dependencies{Config: &config.Config{}, Logger: testLogger(), DBPool: db, SessionStore: sessions})
	req := httptest.NewRequest(http.MethodGet, "/api/analytics/weekly-report/latest", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK || w.Body.String() != "null\n" {
		t.Fatalf("empty weekly report should return 200 null, got %d: %s", w.Code, w.Body.String())
	}
}
