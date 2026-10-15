package httpserver

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func TestGetAnalytics_UsesAuthenticatedLearner(t *testing.T) {
	db := testPool(t)
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Analytics Learner", "analytics-"+userID[:8]+"@example.com", "")
	sessions := session.NewStore(db)
	rawToken := createLearnerSession(t, sessions, userID)
	router := NewRouter(Dependencies{Config: &config.Config{}, Logger: slog.Default(), DBPool: db, SessionStore: sessions})

	unauthorized := httptest.NewRecorder()
	router.ServeHTTP(unauthorized, httptest.NewRequest(http.MethodGet, "/api/analytics", nil))
	if unauthorized.Code != http.StatusUnauthorized {
		t.Fatalf("expected unauthenticated request to return 401, got %d", unauthorized.Code)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/analytics?userId=00000000-0000-4000-8000-000000000001", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var body struct {
		UserID string `json:"userId"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.UserID != userID {
		t.Fatalf("analytics identity must come from the session: got %q, want %q", body.UserID, userID)
	}
}

func TestGetAnalyticsHeatmap_UsesAuthenticatedLearner(t *testing.T) {
	db := testPool(t)
	userID, otherUserID := newUUID(t), newUUID(t)
	seedActiveUser(t, db, userID, "Heatmap Learner", "heatmap-"+userID[:8]+"@example.com", "")
	seedActiveUser(t, db, otherUserID, "Other Learner", "heatmap-"+otherUserID[:8]+"@example.com", "")
	if _, err := db.Exec(context.Background(), `INSERT INTO learning.study_session (user_id, mode, duration_minutes, reviews_done, quizzes_done) VALUES ($1, 'focus', 12, 2, 1), ($2, 'focus', 3, 0, 0)`, userID, otherUserID); err != nil {
		t.Fatalf("seed heatmap sessions: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.study_session WHERE user_id IN ($1, $2)`, userID, otherUserID)
	})
	sessions := session.NewStore(db)
	rawToken := createLearnerSession(t, sessions, userID)
	router := NewRouter(Dependencies{Config: &config.Config{}, Logger: slog.Default(), DBPool: db, SessionStore: sessions})

	unauthorized := httptest.NewRecorder()
	router.ServeHTTP(unauthorized, httptest.NewRequest(http.MethodGet, "/api/analytics/heatmap", nil))
	if unauthorized.Code != http.StatusUnauthorized {
		t.Fatalf("expected unauthenticated request to return 401, got %d", unauthorized.Code)
	}
	invalidDays := httptest.NewRecorder()
	invalidRequest := httptest.NewRequest(http.MethodGet, "/api/analytics/heatmap?days=366", nil)
	invalidRequest.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	router.ServeHTTP(invalidDays, invalidRequest)
	if invalidDays.Code != http.StatusBadRequest {
		t.Fatalf("expected days above the 365-day maximum to return 400, got %d", invalidDays.Code)
	}

	for _, target := range []string{
		"/api/analytics/heatmap?days=365&userId=" + otherUserID,
		"/api/analytics/heatmap?days=365",
	} {
		req := httptest.NewRequest(http.MethodGet, target, nil)
		req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("%s: expected 200, got %d: %s", target, w.Code, w.Body.String())
		}
		var body struct {
			Days []struct {
				Date         string `json:"date"`
				Reviews      int    `json:"reviews"`
				Quizzes      int    `json:"quizzes"`
				FocusMinutes int    `json:"focusMinutes"`
				Total        int    `json:"total"`
				Level        int    `json:"level"`
			} `json:"days"`
			TotalDaysActive int `json:"totalDaysActive"`
			LongestStreak   int `json:"longestStreak"`
			CurrentStreak   int `json:"currentStreak"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
			t.Fatalf("%s: decode response: %v", target, err)
		}
		if len(body.Days) != 365 || body.TotalDaysActive != 1 || body.LongestStreak != 1 || body.CurrentStreak != 1 {
			t.Fatalf("%s: expected the 365-day activity contract with one active day and one-day streaks, got %+v", target, body)
		}
		day := &body.Days[0]
		for i := range body.Days {
			if body.Days[i].Total > 0 {
				day = &body.Days[i]
				break
			}
		}
		if day.FocusMinutes != 12 || day.Reviews != 2 || day.Quizzes != 1 || day.Total != 15 || day.Level != 2 {
			t.Fatalf("%s: expected only the authenticated learner's activity in the UI contract, got %+v", target, day)
		}
	}
}
