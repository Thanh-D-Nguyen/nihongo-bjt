package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func TestGetBattleLeaderboardLearnerContract(t *testing.T) {
	db := testPool(t)
	winnerID, loserID := newUUID(t), newUUID(t)
	seedActiveUser(t, db, winnerID, "Leaderboard Winner", fmt.Sprintf("battle-winner-%s@example.test", winnerID[:8]), "")
	seedActiveUser(t, db, loserID, "Leaderboard Loser", fmt.Sprintf("battle-loser-%s@example.test", loserID[:8]), "")

	roomCode := "lb-" + winnerID[:8]
	if _, err := db.Exec(context.Background(), `
		INSERT INTO learning.battle_session
			(user_id, opponent_user_id, room_code, mode, status, user_score, opponent_score, max_rounds, fairness_seed, started_at, completed_at)
		VALUES ($1, $2, $3, 'pvp', 'completed', 8, 3, 1, 'audit-fixture', NOW() - INTERVAL '120 days', NOW())`, winnerID, loserID, roomCode); err != nil {
		t.Fatalf("seed leaderboard match: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.battle_session WHERE room_code=$1`, roomCode)
	})

	sessions := session.NewStore(db)
	token := createLearnerSession(t, sessions, winnerID)
	router := NewRouter(Dependencies{Config: &config.Config{}, Logger: testLogger(), DBPool: db, SessionStore: sessions})
	request := func(path string, authenticated bool) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(http.MethodGet, path, nil)
		if authenticated {
			req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
		}
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		return w
	}

	if got := request("/api/battle/leaderboard?window=30d&page=1&pageSize=15", false).Code; got != http.StatusUnauthorized {
		t.Fatalf("anonymous status=%d, want 401", got)
	}

	response := request("/api/battle/leaderboard?window=all&page=1&pageSize=15", true)
	if response.Code != http.StatusOK {
		t.Fatalf("authenticated status=%d, want 200: %s", response.Code, response.Body.String())
	}
	var body struct {
		Items []struct {
			AvgScore     float64 `json:"avgScore"`
			DisplayName  string  `json:"displayName"`
			IsYou        bool    `json:"isYou"`
			Losses       int     `json:"losses"`
			Rank         int     `json:"rank"`
			TotalMatches int     `json:"totalMatches"`
			WinRate      float64 `json:"winRate"`
			Wins         int     `json:"wins"`
		} `json:"items"`
		Page     int `json:"page"`
		PageSize int `json:"pageSize"`
		Total    int `json:"total"`
		Summary  struct {
			CompletedMatches  int    `json:"completedMatches"`
			TotalParticipants int    `json:"totalParticipants"`
			Window            string `json:"window"`
		} `json:"summary"`
		ViewerRank *struct {
			Rank        int    `json:"rank"`
			DisplayName string `json:"displayName"`
		} `json:"viewerRank"`
	}
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode leaderboard response: %v", err)
	}
	if len(body.Items) != 2 || body.Page != 1 || body.PageSize != 15 || body.Total != 2 || body.Summary.CompletedMatches != 1 || body.Summary.TotalParticipants != 2 || body.Summary.Window != "all" {
		t.Fatalf("unexpected response summary: %+v", body)
	}
	winner, loser := body.Items[0], body.Items[1]
	if winner.Rank != 1 || winner.DisplayName != "Leaderboard Winner" || !winner.IsYou || winner.Wins != 1 || winner.TotalMatches != 1 || winner.WinRate != 100 || winner.AvgScore != 8 {
		t.Fatalf("unexpected winner row: %+v", winner)
	}
	if loser.Rank != 2 || loser.DisplayName != "Leaderboard Loser" || loser.IsYou || loser.Losses != 1 || loser.TotalMatches != 1 || loser.WinRate != 0 || loser.AvgScore != 3 {
		t.Fatalf("unexpected opponent row: %+v", loser)
	}
	if body.ViewerRank == nil || body.ViewerRank.Rank != 1 || body.ViewerRank.DisplayName != "Leaderboard Winner" {
		t.Fatalf("unexpected viewer rank: %+v", body.ViewerRank)
	}
	if strings.Contains(response.Body.String(), "@example.test") {
		t.Fatal("leaderboard response leaked participant email")
	}

	pageTwo := request("/api/battle/leaderboard?window=all&page=2&pageSize=1", true)
	if pageTwo.Code != http.StatusOK || !strings.Contains(pageTwo.Body.String(), `"rank":2`) || !strings.Contains(pageTwo.Body.String(), `"displayName":"Leaderboard Loser"`) {
		t.Fatalf("pagination did not preserve global rank: status=%d body=%s", pageTwo.Code, pageTwo.Body.String())
	}
	empty := request("/api/battle/leaderboard?window=90d", true)
	if empty.Code != http.StatusOK {
		t.Fatalf("empty window status=%d, want 200: %s", empty.Code, empty.Body.String())
	}
	if !strings.Contains(empty.Body.String(), `"items":[]`) || !strings.Contains(empty.Body.String(), `"viewerRank":null`) {
		t.Fatalf("empty window did not return an empty contract: %s", empty.Body.String())
	}
}
