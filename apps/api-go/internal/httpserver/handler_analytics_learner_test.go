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

func TestGetAnalyticsLearner_ValidatesDaysAndScopesToSession(t *testing.T) {
	db := testPool(t)
	userID, otherUserID := newUUID(t), newUUID(t)
	seedActiveUser(t, db, userID, "Analytics Learner", fmt.Sprintf("analytics-%s@example.com", userID[:8]), "")
	seedActiveUser(t, db, otherUserID, "Other Learner", fmt.Sprintf("analytics-%s@example.com", otherUserID[:8]), "")
	if _, err := db.Exec(context.Background(), `INSERT INTO learning.study_session (user_id, duration_minutes, xp_earned) VALUES ($1, 5, 2), ($2, 11, 9)`, userID, otherUserID); err != nil {
		t.Fatalf("seed study sessions: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.study_session WHERE user_id IN ($1, $2)`, userID, otherUserID)
	})
	sessions := session.NewStore(db)
	rawToken := createLearnerSession(t, sessions, userID)
	router := NewRouter(Dependencies{Config: &config.Config{}, Logger: testLogger(), DBPool: db, SessionStore: sessions})

	anonymous := httptest.NewRecorder()
	router.ServeHTTP(anonymous, httptest.NewRequest(http.MethodGet, "/api/analytics/learner", nil))
	if anonymous.Code != http.StatusUnauthorized {
		t.Fatalf("expected anonymous request to return 401, got %d", anonymous.Code)
	}

	for _, days := range []string{"0", "366", "abc"} {
		req := httptest.NewRequest(http.MethodGet, "/api/analytics/learner?days="+days, nil)
		req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("days=%q: expected 400, got %d: %s", days, w.Code, w.Body.String())
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/api/analytics/learner?days=7&userId="+otherUserID, nil)
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected valid request to return 200, got %d: %s", w.Code, w.Body.String())
	}
	var body struct {
		UserID     string `json:"userId"`
		DailyStats []struct {
			Minutes      int `json:"minutes"`
			XPEarned     int `json:"xpEarned"`
			LessonsCount int `json:"lessonsCount"`
		} `json:"dailyStats"`
		Totals struct {
			CompletedBjtSessions int `json:"completedBjtSessions"`
			ReviewCount          int `json:"reviewCount"`
		} `json:"totals"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.UserID != userID || len(body.DailyStats) != 1 || body.DailyStats[0].Minutes != 5 || body.DailyStats[0].XPEarned != 2 || body.DailyStats[0].LessonsCount != 1 {
		t.Fatalf("valid request should expose only session learner data, got %+v", body)
	}
}
