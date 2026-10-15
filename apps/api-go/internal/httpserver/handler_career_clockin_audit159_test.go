package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/career"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func TestAudit159Wave7CareerClockInInitializesAndIsIdempotentPerTokyoDay(t *testing.T) {
	db := testPool(t)
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Clock-in learner", fmt.Sprintf("clockin-%s@example.test", userID[:8]), "")
	sessions := session.NewStore(db)
	token := createLearnerSession(t, sessions, userID)
	router := NewRouter(Dependencies{
		Config: &config.Config{CORSOrigins: []string{"http://localhost:3000"}},
		Logger: testLogger(), DBPool: db, SessionStore: sessions, CareerStore: career.NewStore(db),
	})
	call := func(sessionToken string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodPost, "/api/career/clock-in", strings.NewReader("{}"))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", "http://localhost:3000")
		if sessionToken != "" {
			req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: sessionToken})
		}
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		return res
	}

	if got := call("").Code; got != http.StatusUnauthorized {
		t.Fatalf("anonymous clock-in status=%d; want 401", got)
	}
	first := call(token)
	if first.Code != http.StatusOK {
		t.Fatalf("first clock-in status=%d body=%s", first.Code, first.Body.String())
	}
	var firstPayload career.CareerMe
	if err := json.Unmarshal(first.Body.Bytes(), &firstPayload); err != nil {
		t.Fatalf("decode first clock-in response: %v", err)
	}
	var firstHasClockIn bool
	var firstXP, firstStreak int
	var firstClockIn string
	if err := db.QueryRow(context.Background(), `SELECT last_clock_in_at IS NOT NULL, rank_xp, streak_days, COALESCE(last_clock_in_at::text,'') FROM career.user_career_state WHERE user_id=$1`, userID).Scan(&firstHasClockIn, &firstXP, &firstStreak, &firstClockIn); err != nil {
		t.Fatalf("load first clock-in state: %v", err)
	}
	if firstPayload.LastClockInAt == nil || !firstHasClockIn || firstXP != 10 || firstStreak != 1 {
		t.Fatalf("first clock-in response/state mismatch: response=%+v persisted=(has=%v,xp=%d,streak=%d)", firstPayload, firstHasClockIn, firstXP, firstStreak)
	}

	second := call(token)
	if second.Code != http.StatusOK {
		t.Fatalf("same-day clock-in status=%d body=%s", second.Code, second.Body.String())
	}
	var secondXP, secondStreak int
	var secondClockIn string
	if err := db.QueryRow(context.Background(), `SELECT rank_xp, streak_days, COALESCE(last_clock_in_at::text,'') FROM career.user_career_state WHERE user_id=$1`, userID).Scan(&secondXP, &secondStreak, &secondClockIn); err != nil {
		t.Fatalf("load repeated clock-in state: %v", err)
	}
	if secondXP != firstXP || secondStreak != firstStreak || secondClockIn != firstClockIn {
		t.Fatalf("same-day clock-in changed state: first=(%q,xp=%d,streak=%d) second=(%q,xp=%d,streak=%d)", firstClockIn, firstXP, firstStreak, secondClockIn, secondXP, secondStreak)
	}
}
