package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func TestBattleLobbyCanonicalContracts(t *testing.T) {
	db := testPool(t)
	userID := newUUID(t)
	participantID := newUUID(t)
	outsiderID := newUUID(t)
	seedActiveUser(t, db, userID, "Battle Lobby Learner", fmt.Sprintf("battle-lobby-%s@example.test", userID[:8]), "")
	seedActiveUser(t, db, participantID, "Battle Lobby Participant", fmt.Sprintf("battle-participant-%s@example.test", participantID[:8]), "")
	seedActiveUser(t, db, outsiderID, "Battle Lobby Outsider", fmt.Sprintf("battle-outsider-%s@example.test", outsiderID[:8]), "")
	botKey := "audit_" + strings.ReplaceAll(userID[:12], "-", "")
	configName := "Audit battle config " + userID[:8]
	chatMarker := "audit-chat-" + userID[:8]
	roomCode := "audit" + strings.ReplaceAll(userID[:10], "-", "")
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.battle_chat_message WHERE user_id=$1 AND message LIKE $2`, userID, chatMarker+"%")
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.battle_session WHERE room_code=$1`, roomCode)
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.battle_config WHERE name LIKE $1`, "Audit battle config "+userID[:8]+"%")
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.battle_bot WHERE bot_key=$1`, botKey)
	})
	if _, err := db.Exec(context.Background(), `
		INSERT INTO learning.battle_bot
			(bot_key, name, difficulty, persona, accuracy_pct, min_delay_ms, max_delay_ms, vocabulary_level, avatar_fallback, style_token, status, updated_at)
		VALUES ($1, 'Audit Bot', 'medium', 'battle.botPersonas.j3', 55, 350, 2000, 'bjt_intermediate', 'AB', 'focused', 'active', NOW())`, botKey); err != nil {
		t.Fatalf("seed battle bot: %v", err)
	}
	if _, err := db.Exec(context.Background(), `
		INSERT INTO learning.battle_config
			(name, description, level, question_pool_key, question_count, time_per_question_sec, max_participants, bot_difficulties, scoring_rules, status, schedule_start, published_at, updated_at)
		VALUES ($1, 'Canonical config fixture', 'N2', 'bjt_questions_active', 12, 30, 2, ARRAY['medium'], '{"gameType":"speed_duel"}'::jsonb, 'published', NULL, NOW(), NOW()),
		       ($2, 'Upcoming config fixture', 'N1', 'business_phrase_pack', 8, 45, 4, ARRAY['hard'], '{"gameType":"business_roleplay"}'::jsonb, 'published', NOW() + INTERVAL '1 day', NOW(), NOW()),
		       ($3, 'Draft config fixture', 'N3', 'vocab_high_freq', 5, 60, 2, ARRAY[]::text[], '{}'::jsonb, 'draft', NULL, NOW(), NOW())`, configName, configName+" upcoming", configName+" draft"); err != nil {
		t.Fatalf("seed battle configs: %v", err)
	}
	if _, err := db.Exec(context.Background(), `
		INSERT INTO learning.battle_session (user_id, opponent_user_id, room_code, max_rounds, fairness_seed)
		VALUES ($1, $2, $3, 1, 'audit-seed')`, userID, participantID, roomCode); err != nil {
		t.Fatalf("seed private battle session: %v", err)
	}
	if _, err := db.Exec(context.Background(), `
		INSERT INTO learning.battle_chat_message (room_key, user_id, display_name, message, moderation_state, created_at)
		VALUES ('global', $1, 'Audit Sender', $2 || ' older', 'visible', NOW() - INTERVAL '1 minute'),
		       ('global', $1, 'Audit Sender', $2 || ' newest', 'visible', NOW()),
		       ('global', $1, 'Audit Sender', $2 || ' hidden', 'hidden', NOW())`, userID, chatMarker); err != nil {
		t.Fatalf("seed battle chat: %v", err)
	}
	if _, err := db.Exec(context.Background(), `
		INSERT INTO learning.battle_chat_message (room_key, session_id, user_id, display_name, message, moderation_state)
		VALUES ($1, (SELECT id FROM learning.battle_session WHERE room_code=$2), $3, 'Audit Sender', $4, 'visible')`, roomCode, roomCode, userID, chatMarker+" private"); err != nil {
		t.Fatalf("seed private battle chat: %v", err)
	}

	sessions := session.NewStore(db)
	token := createLearnerSession(t, sessions, userID)
	participantToken := createLearnerSession(t, sessions, participantID)
	outsiderToken := createLearnerSession(t, sessions, outsiderID)
	router := NewRouter(Dependencies{Config: &config.Config{CORSOrigins: []string{"http://localhost:18081"}}, Logger: testLogger(), DBPool: db, SessionStore: sessions})
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
	requestWithToken := func(path, token string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		return w
	}

	botResponse := request("/api/battle/bots", false)
	if botResponse.Code != http.StatusOK {
		t.Fatalf("bots status=%d body=%s", botResponse.Code, botResponse.Body.String())
	}
	var bots []struct {
		AccuracyPct     int     `json:"accuracyPct"`
		AvatarFallback  string  `json:"avatarFallback"`
		BotKey          string  `json:"botKey"`
		Difficulty      string  `json:"difficulty"`
		Label           string  `json:"label"`
		MaxDelayMs      int     `json:"maxDelayMs"`
		MinDelayMs      int     `json:"minDelayMs"`
		Persona         *string `json:"persona"`
		StyleToken      string  `json:"styleToken"`
		VocabularyLevel string  `json:"vocabularyLevel"`
	}
	if err := json.Unmarshal(botResponse.Body.Bytes(), &bots); err != nil {
		t.Fatalf("decode bots: %v", err)
	}
	var foundBot bool
	for _, bot := range bots {
		if bot.BotKey == botKey {
			foundBot = true
			if bot.Label != "Audit Bot" || bot.Difficulty != "medium" || bot.AccuracyPct != 55 || bot.MinDelayMs != 350 || bot.MaxDelayMs != 2000 || bot.AvatarFallback != "AB" || bot.StyleToken != "focused" || bot.VocabularyLevel != "bjt_intermediate" || bot.Persona == nil || *bot.Persona != "battle.botPersonas.j3" {
				t.Fatalf("unexpected bot DTO: %+v", bot)
			}
		}
	}
	if !foundBot {
		t.Fatalf("active battle bot %q missing from %s", botKey, botResponse.Body.String())
	}

	configResponse := request("/api/battle/configs/available", false)
	if configResponse.Code != http.StatusOK {
		t.Fatalf("configs status=%d body=%s", configResponse.Code, configResponse.Body.String())
	}
	var configs []struct {
		BotDifficulties    []string       `json:"botDifficulties"`
		GameType           string         `json:"gameType"`
		IsActive           bool           `json:"isActive"`
		IsUpcoming         bool           `json:"isUpcoming"`
		Level              string         `json:"level"`
		Name               string         `json:"name"`
		QuestionCount      int            `json:"questionCount"`
		QuestionPoolKey    string         `json:"questionPoolKey"`
		ScoringRules       map[string]any `json:"scoringRules"`
		TimePerQuestionSec int            `json:"timePerQuestionSec"`
	}
	if err := json.Unmarshal(configResponse.Body.Bytes(), &configs); err != nil {
		t.Fatalf("decode configs: %v", err)
	}
	var foundActive, foundUpcoming, foundDraft bool
	for _, item := range configs {
		switch item.Name {
		case configName:
			foundActive = item.IsActive && !item.IsUpcoming && item.Level == "N2" && item.GameType == "speed_duel" && item.QuestionPoolKey == "bjt_questions_active" && item.QuestionCount == 12 && item.TimePerQuestionSec == 30 && len(item.BotDifficulties) == 1
		case configName + " upcoming":
			foundUpcoming = item.IsUpcoming && !item.IsActive && item.GameType == "business_roleplay"
		case configName + " draft":
			foundDraft = true
		}
	}
	if !foundActive || !foundUpcoming || foundDraft {
		t.Fatalf("published config contract mismatch: active=%v upcoming=%v draftIncluded=%v body=%s", foundActive, foundUpcoming, foundDraft, configResponse.Body.String())
	}

	if got := request("/api/battle/chat/recent?limit=1&roomKey=global", false).Code; got != http.StatusUnauthorized {
		t.Fatalf("anonymous chat status=%d, want 401", got)
	}
	chatResponse := request("/api/battle/chat/recent?limit=1&roomKey=global", true)
	if chatResponse.Code != http.StatusOK {
		t.Fatalf("chat status=%d body=%s", chatResponse.Code, chatResponse.Body.String())
	}
	var messages []struct {
		CreatedAt   string  `json:"createdAt"`
		DisplayName *string `json:"displayName"`
		ID          string  `json:"id"`
		Kind        string  `json:"kind"`
		Message     string  `json:"message"`
		RoomKey     string  `json:"roomKey"`
		UserID      string  `json:"userId"`
	}
	if err := json.Unmarshal(chatResponse.Body.Bytes(), &messages); err != nil {
		t.Fatalf("decode chat: %v", err)
	}
	if len(messages) != 1 || messages[0].Message != chatMarker+" newest" || messages[0].RoomKey != "global" || messages[0].UserID != userID || messages[0].DisplayName == nil || *messages[0].DisplayName != "Audit Sender" || messages[0].Kind != "chat" {
		t.Fatalf("chat did not honor visible room and limit: %s", chatResponse.Body.String())
	}
	if _, err := time.Parse(time.RFC3339, messages[0].CreatedAt); err != nil {
		t.Fatalf("invalid createdAt %q: %v", messages[0].CreatedAt, err)
	}
	unauthPost := httptest.NewRequest(http.MethodPost, "/api/battle/chat", strings.NewReader(`{"message":"unauthenticated"}`))
	unauthPost.Header.Set("Origin", "http://localhost:18081")
	unauthW := httptest.NewRecorder()
	router.ServeHTTP(unauthW, unauthPost)
	if unauthW.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous post chat status=%d body=%s", unauthW.Code, unauthW.Body.String())
	}
	invalidPost := func(body string, origin bool) int {
		t.Helper()
		req := httptest.NewRequest(http.MethodPost, "/api/battle/chat", strings.NewReader(body))
		req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
		if origin {
			req.Header.Set("Origin", "http://localhost:18081")
		}
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		return w.Code
	}
	if got := invalidPost(`{"message":"valid"}`, false); got != http.StatusForbidden {
		t.Fatalf("missing-origin post chat status=%d, want 403", got)
	}
	if got := invalidPost(`{"message":"  "}`, true); got != http.StatusBadRequest {
		t.Fatalf("empty post chat status=%d, want 400", got)
	}
	if got := invalidPost(`{"message":"`+strings.Repeat("x", 501)+`"}`, true); got != http.StatusBadRequest {
		t.Fatalf("oversized post chat status=%d, want 400", got)
	}
	postReq := httptest.NewRequest(http.MethodPost, "/api/battle/chat", strings.NewReader(`{"message":"`+chatMarker+` posted"}`))
	postReq.Header.Set("Content-Type", "application/json")
	postReq.Header.Set("Origin", "http://localhost:18081")
	postReq.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
	postW := httptest.NewRecorder()
	router.ServeHTTP(postW, postReq)
	if postW.Code != http.StatusCreated {
		t.Fatalf("post chat status=%d body=%s", postW.Code, postW.Body.String())
	}
	var posted struct {
		DisplayName *string `json:"displayName"`
		Message     string  `json:"message"`
		RoomKey     string  `json:"roomKey"`
		UserID      string  `json:"userId"`
	}
	if err := json.Unmarshal(postW.Body.Bytes(), &posted); err != nil {
		t.Fatalf("decode posted chat: %v", err)
	}
	if posted.Message != chatMarker+" posted" || posted.RoomKey != "global" || posted.UserID != userID || posted.DisplayName == nil || *posted.DisplayName != "Battle Lobby Learner" {
		t.Fatalf("chat identity/persistence response mismatch: %s", postW.Body.String())
	}
	if _, err := db.Exec(context.Background(), `DELETE FROM learning.battle_chat_message WHERE user_id=$1 AND message=$2`, userID, posted.Message); err != nil {
		t.Fatalf("cleanup posted chat: %v", err)
	}
	privatePath := "/api/battle/chat/recent?roomKey=" + roomCode
	participantResponse := requestWithToken(privatePath, participantToken)
	if participantResponse.Code != http.StatusOK || !strings.Contains(participantResponse.Body.String(), chatMarker+" private") {
		t.Fatalf("session participant cannot read private chat: status=%d body=%s", participantResponse.Code, participantResponse.Body.String())
	}
	outsiderResponse := requestWithToken(privatePath, outsiderToken)
	if outsiderResponse.Code != http.StatusOK || outsiderResponse.Body.String() != "[]\n" {
		t.Fatalf("outsider received private chat: status=%d body=%s", outsiderResponse.Code, outsiderResponse.Body.String())
	}

	// Player stats contract: 401 unauthenticated, 400 invalid userId, 200 aggregate stats.
	if got := request("/api/battle/player-stats?userId="+userID, false).Code; got != http.StatusUnauthorized {
		t.Fatalf("anonymous player-stats status=%d, want 401", got)
	}
	if got := request("/api/battle/player-stats?userId=not-a-uuid", true).Code; got != http.StatusBadRequest {
		t.Fatalf("invalid UUID player-stats status=%d, want 400", got)
	}
	statsRoomWin := "swin" + strings.ReplaceAll(userID[:8], "-", "")
	statsRoomLoss := "sloss" + strings.ReplaceAll(userID[:8], "-", "")
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.battle_session WHERE room_code IN ($1, $2)`, statsRoomWin, statsRoomLoss)
	})
	if _, err := db.Exec(context.Background(), `
		INSERT INTO learning.battle_session (user_id, opponent_user_id, room_code, mode, status, max_rounds, user_score, opponent_score, fairness_seed)
		VALUES ($1, NULL, $3, 'bot', 'completed', 5, 400, 200, 'seed-w'),
		       ($2, $1, $4, 'pvp', 'completed', 5, 500, 300, 'seed-l')`,
		userID, participantID, statsRoomWin, statsRoomLoss); err != nil {
		t.Fatalf("seed player-stats sessions: %v", err)
	}
	statsRes := request("/api/battle/player-stats?userId="+userID, true)
	if statsRes.Code != http.StatusOK {
		t.Fatalf("player-stats status=%d body=%s", statsRes.Code, statsRes.Body.String())
	}
	var stats struct {
		CompletedMatches int     `json:"completedMatches"`
		Draws            int     `json:"draws"`
		Losses           int     `json:"losses"`
		WinRatePct       float64 `json:"winRatePct"`
		Wins             int     `json:"wins"`
	}
	if err := json.Unmarshal(statsRes.Body.Bytes(), &stats); err != nil {
		t.Fatalf("decode player-stats: %v", err)
	}
	if stats.CompletedMatches != 2 || stats.Wins != 1 || stats.Losses != 1 || stats.Draws != 0 || stats.WinRatePct != 50 {
		t.Fatalf("unexpected player-stats payload: %+v", stats)
	}
}
