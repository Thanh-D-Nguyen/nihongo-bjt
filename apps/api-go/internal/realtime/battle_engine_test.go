package realtime

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"strings"
	"sync"
	"testing"
	"time"
)

type fakeBattleStore struct {
	mu                sync.Mutex
	seq               int
	bots              map[string]*PlayableBattleBot
	configs           map[string]*BattleConfigParams
	questions         []BattleQuestionPayload
	botRounds         []BotRoundUpdate
	pvpRounds         []PvpRoundUpdate
	completedSessions map[string][2]int
	abandonedSessions map[string]string
	chatMessages      []LobbyMessage
	analyticsEvents   []string
}

func newFakeBattleStore() *fakeBattleStore {
	return &fakeBattleStore{
		bots:              make(map[string]*PlayableBattleBot),
		configs:           make(map[string]*BattleConfigParams),
		completedSessions: make(map[string][2]int),
		abandonedSessions: make(map[string]string),
		questions: []BattleQuestionPayload{
			{
				QuestionID: "q-1",
				Prompt:     "敬語の基本として正しいものはどれですか。",
				SkillTag:   "敬語",
				Options: []BattleQuestionOption{
					{OptionKey: "A", Text: "承知いたしました", IsCorrect: true},
					{OptionKey: "B", Text: "了解っす"},
					{OptionKey: "C", Text: "わかった"},
					{OptionKey: "D", Text: "オーケー"},
				},
			},
			{
				QuestionID: "q-2",
				Prompt:     "会議の冒頭で使う挨拶はどれですか。",
				SkillTag:   "会議",
				Options: []BattleQuestionOption{
					{OptionKey: "A", Text: "お疲れ〜"},
					{OptionKey: "B", Text: "本日はお集まりいただきありがとうございます", IsCorrect: true},
					{OptionKey: "C", Text: "じゃあ始めよう"},
					{OptionKey: "D", Text: "よろしく"},
				},
			},
		},
	}
}

func (f *fakeBattleStore) GetPlayableBot(_ context.Context, botKey string) (*PlayableBattleBot, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if b, ok := f.bots[botKey]; ok {
		return b, nil
	}
	if b, ok := RegistryPlayableBot(botKey); ok && b != nil {
		cp := *b
		cp.MinDelayMs = 1
		cp.MaxDelayMs = 2
		return &cp, nil
	}
	return nil, nil
}

func (f *fakeBattleStore) GetPublishedConfig(_ context.Context, configID string) (*BattleConfigParams, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.configs[configID], nil
}

func (f *fakeBattleStore) AbandonInProgressForUser(_ context.Context, _ string, _ string) error {
	return nil
}

func (f *fakeBattleStore) CreateBotBattle(_ context.Context, _, _, fairnessSeed string, maxRounds int) (*CreatedBattle, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.seq++
	roomCode := fmt.Sprintf("botroom%d", f.seq)
	sessionID := fmt.Sprintf("sess-%d", f.seq)
	shuffled := ShuffleDeterministic(f.questions, fairnessSeed)
	if maxRounds > 0 && maxRounds < len(shuffled) {
		shuffled = shuffled[:maxRounds]
	}
	roundIDs := make([]string, len(shuffled))
	for i := range shuffled {
		roundIDs[i] = fmt.Sprintf("%s-r-%d", sessionID, i)
	}
	return &CreatedBattle{
		SessionID: sessionID,
		RoomCode:  roomCode,
		Questions: shuffled,
		RoundIDs:  roundIDs,
	}, nil
}

func (f *fakeBattleStore) CreatePvpBattle(_ context.Context, _, _, fairnessSeed string, maxRounds int) (*CreatedBattle, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.seq++
	roomCode := fmt.Sprintf("pvproom%d", f.seq)
	sessionID := fmt.Sprintf("pvpsess-%d", f.seq)
	shuffled := ShuffleDeterministic(f.questions, fairnessSeed)
	if maxRounds > 0 && maxRounds < len(shuffled) {
		shuffled = shuffled[:maxRounds]
	}
	roundIDs := make([]string, len(shuffled))
	for i := range shuffled {
		roundIDs[i] = fmt.Sprintf("%s-r-%d", sessionID, i)
	}
	return &CreatedBattle{
		SessionID: sessionID,
		RoomCode:  roomCode,
		Questions: shuffled,
		RoundIDs:  roundIDs,
	}, nil
}

func (f *fakeBattleStore) UpdateBotRoundWithScores(_ context.Context, u BotRoundUpdate) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.botRounds = append(f.botRounds, u)
	return nil
}

func (f *fakeBattleStore) UpdatePvpRoundWithScores(_ context.Context, u PvpRoundUpdate) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.pvpRounds = append(f.pvpRounds, u)
	return nil
}

func (f *fakeBattleStore) MarkCompleted(_ context.Context, sessionID string, userScore, opponentScore int) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.completedSessions[sessionID] = [2]int{userScore, opponentScore}
	return nil
}

func (f *fakeBattleStore) MarkAbandoned(_ context.Context, sessionID, reason string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.abandonedSessions[sessionID] = reason
	return nil
}

func (f *fakeBattleStore) CreateChatMessage(_ context.Context, roomKey, userID string, displayName *string, message, kind string, _ map[string]any) (*LobbyMessage, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.seq++
	msg := LobbyMessage{
		ID:          fmt.Sprintf("msg-%d", f.seq),
		RoomKey:     roomKey,
		UserID:      userID,
		DisplayName: displayName,
		Message:     message,
		Kind:        kind,
		CreatedAt:   time.Now().UTC().Format(time.RFC3339),
	}
	f.chatMessages = append(f.chatMessages, msg)
	return &msg, nil
}

func (f *fakeBattleStore) CreateAnalyticsEvent(_ context.Context, _, eventName string, _ map[string]any) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.analyticsEvents = append(f.analyticsEvents, eventName)
	return nil
}

func newTestBattleEngine() (*Hub, *BattleHandler, *fakeBattleStore) {
	hub := NewHub()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	bh := NewBattleHandler(hub, logger)
	store := newFakeBattleStore()
	bh.SetStore(store)
	bh.timings = BattleTimings{
		InitialCountdownStep: 1 * time.Millisecond,
		InterCountdownStep:   1 * time.Millisecond,
		RoundTimeout:         2 * time.Second,
		ChallengeExpiry:      2 * time.Second,
		PvpReconnectGrace:    2 * time.Second,
		PvpOpponentAbsentWin: 2 * time.Second,
		BotDelayScale:        -1, // disable artificial bot delay in unit tests
	}
	return hub, bh, store
}

func newTestBattleConn(hub *Hub, bh *BattleHandler, id, userID, displayName string) *Conn {
	c := &Conn{
		ID:          id,
		UserID:      userID,
		DisplayName: displayName,
		Namespace:   "battle",
		Send:        make(chan []byte, 128),
		done:        make(chan struct{}),
	}
	hub.Register(c)
	bh.OnConnect(c)
	return c
}

func waitForEvent(t *testing.T, c *Conn, wantEvent string, timeout time.Duration) Message {
	t.Helper()
	deadline := time.After(timeout)
	for {
		select {
		case raw := <-c.Send:
			msg, err := Decode(raw)
			if err != nil {
				t.Fatalf("failed to decode message: %v", err)
			}
			if msg.Event == wantEvent {
				return *msg
			}
		case <-deadline:
			t.Fatalf("timed out waiting for event %q on conn %s", wantEvent, c.ID)
		}
	}
}

func TestBattleEngine_BotMatchLifecycle(t *testing.T) {
	hub, bh, store := newTestBattleEngine()
	c := newTestBattleConn(hub, bh, "c-bot-1", "11111111-1111-4111-8111-111111111111", "Taro")

	sendMsg := func(event string, data any) {
		raw, _ := json.Marshal(data)
		bh.HandleMessage(c, &Message{Event: event, Data: raw})
	}

	sendMsg("battle:challenge_bot", map[string]any{
		"botKey": "bot_j4",
	})

	matchFoundMsg := waitForEvent(t, c, "battle:match_found", time.Second)
	var matchFound struct {
		RoomCode  string            `json:"roomCode"`
		SessionID string            `json:"sessionId"`
		MaxRounds int               `json:"maxRounds"`
		Bot       PlayableBattleBot `json:"bot"`
	}
	if err := json.Unmarshal(matchFoundMsg.Data, &matchFound); err != nil {
		t.Fatalf("unmarshal match_found: %v", err)
	}
	if matchFound.RoomCode == "" || matchFound.MaxRounds != 2 || matchFound.Bot.BotKey != "bot_j4" {
		t.Fatalf("unexpected match_found payload: %+v", matchFound)
	}

	// The pre-match countdown runs before the first question.
	cdMsg := waitForEvent(t, c, "battle:countdown", time.Second)
	if !strings.Contains(string(cdMsg.Data), "value") {
		t.Fatalf("countdown payload missing value: %s", cdMsg.Data)
	}

	// Wait for round 0 question
	q0Msg := waitForEvent(t, c, "battle:question", time.Second)
	if strings.Contains(string(q0Msg.Data), "correctOptionKey") || strings.Contains(string(q0Msg.Data), "isCorrect") {
		t.Fatalf("security violation: question payload leaked answer key: %s", string(q0Msg.Data))
	}
	var q0 QuestionEventPayload
	if err := json.Unmarshal(q0Msg.Data, &q0); err != nil {
		t.Fatalf("unmarshal question 0: %v", err)
	}
	if q0.RoundIndex != 0 || len(q0.Question.Options) != 4 {
		t.Fatalf("unexpected question 0: %+v", q0)
	}

	// Answer round 0 with wrong option "D"
	sendMsg("battle:answer", map[string]any{
		"roomCode":       matchFound.RoomCode,
		"roundIndex":     0,
		"optionKey":      "D",
		"idempotencyKey": "idem-r0",
	})

	res0Msg := waitForEvent(t, c, "battle:answer_result", time.Second)
	var res0 AnswerResultPayload
	if err := json.Unmarshal(res0Msg.Data, &res0); err != nil {
		t.Fatalf("unmarshal answer_result 0: %v", err)
	}
	if res0.RoundIndex != 0 || res0.UserCorrect {
		t.Fatalf("expected wrong user answer in round 0, got %+v", res0)
	}
	scoreMsg := waitForEvent(t, c, "battle:score_update", time.Second)
	var score0 ScoreUpdatePayload
	if err := json.Unmarshal(scoreMsg.Data, &score0); err != nil {
		t.Fatalf("unmarshal score_update: %v", err)
	}
	if score0.UserScore != 0 {
		t.Fatalf("unexpected score_update after wrong answer: %+v", score0)
	}

	// Wait for round 1 question
	q1Msg := waitForEvent(t, c, "battle:question", time.Second)
	var q1 QuestionEventPayload
	if err := json.Unmarshal(q1Msg.Data, &q1); err != nil {
		t.Fatalf("unmarshal question 1: %v", err)
	}
	if q1.RoundIndex != 1 {
		t.Fatalf("expected roundIndex 1, got %d", q1.RoundIndex)
	}

	// Answer round 1 with wrong option "D"
	sendMsg("battle:answer", map[string]any{
		"roomCode":       matchFound.RoomCode,
		"roundIndex":     1,
		"optionKey":      "D",
		"idempotencyKey": "idem-r1",
	})

	finMsg := waitForEvent(t, c, "battle:finished", time.Second)
	var fin FinishedEventPayload
	if err := json.Unmarshal(finMsg.Data, &fin); err != nil {
		t.Fatalf("unmarshal finished: %v", err)
	}
	if fin.SessionID != matchFound.SessionID {
		t.Fatalf("unexpected finished payload: %+v", fin)
	}

	store.mu.Lock()
	_, completed := store.completedSessions[matchFound.SessionID]
	roundsCount := len(store.botRounds)
	store.mu.Unlock()
	if !completed {
		t.Errorf("expected session %s to be marked completed in store", matchFound.SessionID)
	}
	if roundsCount != 2 {
		t.Errorf("expected 2 recorded bot rounds, got %d", roundsCount)
	}
}

func TestBattleEngine_BotAnswerValidationAndAbuse(t *testing.T) {
	hub, bh, store := newTestBattleEngine()
	c1 := newTestBattleConn(hub, bh, "c-user-1", "11111111-1111-4111-8111-111111111111", "User 1")
	c2 := newTestBattleConn(hub, bh, "c-user-2", "22222222-2222-4222-8222-222222222222", "User 2")

	rawChallenge, _ := json.Marshal(map[string]any{"botKey": "bot_j1"})
	bh.HandleMessage(c1, &Message{Event: "battle:challenge_bot", Data: rawChallenge})

	matchMsg := waitForEvent(t, c1, "battle:match_found", time.Second)
	var match struct {
		RoomCode  string `json:"roomCode"`
		SessionID string `json:"sessionId"`
	}
	_ = json.Unmarshal(matchMsg.Data, &match)
	_ = waitForEvent(t, c1, "battle:question", time.Second)

	// A non-owner is rejected and can never add strikes to the owner's room, however often it tries.
	rawOther, _ := json.Marshal(map[string]any{
		"roomCode":       match.RoomCode,
		"roundIndex":     0,
		"optionKey":      "A",
		"idempotencyKey": "other-1",
	})
	for i := 0; i < invalidAnswerStrikeLimit+2; i++ {
		bh.HandleMessage(c2, &Message{Event: "battle:answer", Data: rawOther})
		errOther := waitForEvent(t, c2, "battle:error", time.Second)
		if !strings.Contains(string(errOther.Data), "answer_rejected") {
			t.Fatalf("expected answer_rejected error for other user, got %s", string(errOther.Data))
		}
	}
	store.mu.Lock()
	_, abandonedByOutsider := store.abandonedSessions[match.SessionID]
	store.mu.Unlock()
	if abandonedByOutsider {
		t.Fatalf("non-owner attempts must not abandon the owner's match")
	}

	// The owner's own invalid round/option attempts reach invalidAnswerStrikeLimit, triggering abuse_detected and abandoning the session.
	for i := 0; i < invalidAnswerStrikeLimit; i++ {
		rawBad, _ := json.Marshal(map[string]any{
			"roomCode":       match.RoomCode,
			"roundIndex":     99,
			"optionKey":      "Z",
			"idempotencyKey": fmt.Sprintf("bad-%d", i),
		})
		bh.HandleMessage(c1, &Message{Event: "battle:answer", Data: rawBad})
	}
	var sawAbuse bool
	deadline := time.After(time.Second)
	for !sawAbuse {
		select {
		case raw := <-c1.Send:
			msg, _ := Decode(raw)
			if msg != nil && msg.Event == "battle:error" && strings.Contains(string(msg.Data), "abuse_detected") {
				sawAbuse = true
			}
		case <-deadline:
			t.Fatalf("timed out waiting for abuse_detected on c1")
		}
	}
	store.mu.Lock()
	abandonReason := store.abandonedSessions[match.SessionID]
	store.mu.Unlock()
	if abandonReason != "anti_abuse_threshold" {
		t.Fatalf("expected store MarkAbandoned reason 'anti_abuse_threshold', got %q", abandonReason)
	}
}

func TestBattleEngine_PvpChallengeAcceptAndMatchFlow(t *testing.T) {
	hub, bh, store := newTestBattleEngine()
	u1 := "11111111-1111-4111-8111-111111111111"
	u2 := "22222222-2222-4222-8222-222222222222"
	c1 := newTestBattleConn(hub, bh, "c-pvp-1", u1, "Player One")
	c2 := newTestBattleConn(hub, bh, "c-pvp-2", u2, "Player Two")

	bh.HandleMessage(c1, &Message{Event: "battle:lobby_join", Data: []byte(`{}`)})
	bh.HandleMessage(c2, &Message{Event: "battle:lobby_join", Data: []byte(`{}`)})
	_ = waitForEvent(t, c1, "battle:lobby_joined", time.Second)
	_ = waitForEvent(t, c2, "battle:lobby_joined", time.Second)

	// Self-challenge must be rejected
	rawSelf, _ := json.Marshal(map[string]any{"targetUserId": u1})
	bh.HandleMessage(c1, &Message{Event: "battle:challenge_user", Data: rawSelf})
	selfErr := waitForEvent(t, c1, "battle:lobby_error", time.Second)
	if !strings.Contains(string(selfErr.Data), "cannot_challenge_self") {
		t.Fatalf("expected cannot_challenge_self, got %s", string(selfErr.Data))
	}

	// u1 challenges u2
	rawChal, _ := json.Marshal(map[string]any{"targetUserId": u2})
	bh.HandleMessage(c1, &Message{Event: "battle:challenge_user", Data: rawChal})

	sentMsg := waitForEvent(t, c1, "battle:user_challenge_sent", time.Second)
	recvMsg := waitForEvent(t, c2, "battle:user_challenge_received", time.Second)

	var recvData struct {
		ChallengeID     string  `json:"challengeId"`
		FromUserID      string  `json:"fromUserId"`
		FromDisplayName *string `json:"fromDisplayName"`
	}
	_ = json.Unmarshal(recvMsg.Data, &recvData)
	if recvData.ChallengeID == "" || recvData.FromUserID != u1 || recvData.FromDisplayName == nil || *recvData.FromDisplayName != "Player One" {
		t.Fatalf("unexpected challenge received payload: %+v (sent=%s)", recvData, string(sentMsg.Data))
	}

	// u2 accepts challenge
	rawAccept, _ := json.Marshal(map[string]any{"challengeId": recvData.ChallengeID, "fromUserId": u1})
	bh.HandleMessage(c2, &Message{Event: "battle:accept_challenge", Data: rawAccept})

	m1Msg := waitForEvent(t, c1, "battle:pvp_match_found", time.Second)
	m2Msg := waitForEvent(t, c2, "battle:pvp_match_found", time.Second)
	var m1, m2 PvpMatchFoundPayload
	_ = json.Unmarshal(m1Msg.Data, &m1)
	_ = json.Unmarshal(m2Msg.Data, &m2)
	if m1.RoomCode == "" || m1.RoomCode != m2.RoomCode {
		t.Fatalf("roomCode mismatch: %+v vs %+v", m1, m2)
	}
	if m1.OpponentDisplayName == nil || *m1.OpponentDisplayName != "Player Two" || m2.OpponentDisplayName == nil || *m2.OpponentDisplayName != "Player One" {
		t.Fatalf("opponentDisplayName not perspective-swapped: m1=%v m2=%v", m1.OpponentDisplayName, m2.OpponentDisplayName)
	}

	// Round 0 question
	q0Msg := waitForEvent(t, c1, "battle:question", time.Second)
	_ = waitForEvent(t, c2, "battle:question", time.Second)
	var q0 QuestionEventPayload
	_ = json.Unmarshal(q0Msg.Data, &q0)

	// Find the correct option from store for q0.Question.QuestionID
	correctKey0 := "A"
	for _, sq := range store.questions {
		if sq.QuestionID == q0.Question.QuestionID {
			correctKey0 = sq.CorrectOptionKey()
		}
	}
	wrongKey0 := "D"
	if correctKey0 == "D" {
		wrongKey0 = "C"
	}

	// u1 answers correctly, u2 receives battle:pvp_opponent_answered
	ans1R0, _ := json.Marshal(map[string]any{
		"roomCode":       m1.RoomCode,
		"roundIndex":     0,
		"optionKey":      correctKey0,
		"idempotencyKey": "pvp-u1-r0",
	})
	bh.HandleMessage(c1, &Message{Event: "battle:pvp_answer", Data: ans1R0})
	oppAnsMsg := waitForEvent(t, c2, "battle:pvp_opponent_answered", time.Second)
	if !strings.Contains(string(oppAnsMsg.Data), `"roundIndex":0`) {
		t.Fatalf("expected roundIndex 0 in pvp_opponent_answered, got %s", string(oppAnsMsg.Data))
	}

	// u2 answers wrong
	ans2R0, _ := json.Marshal(map[string]any{
		"roomCode":       m1.RoomCode,
		"roundIndex":     0,
		"optionKey":      wrongKey0,
		"idempotencyKey": "pvp-u2-r0",
	})
	bh.HandleMessage(c2, &Message{Event: "battle:pvp_answer", Data: ans2R0})

	r1Msg := waitForEvent(t, c1, "battle:answer_result", time.Second)
	r2Msg := waitForEvent(t, c2, "battle:answer_result", time.Second)
	var ar1, ar2 AnswerResultPayload
	_ = json.Unmarshal(r1Msg.Data, &ar1)
	_ = json.Unmarshal(r2Msg.Data, &ar2)
	if !ar1.UserCorrect || ar1.OpponentCorrect == nil || *ar1.OpponentCorrect {
		t.Fatalf("unexpected u1 answer_result: %+v", ar1)
	}
	if ar2.UserCorrect || ar2.OpponentCorrect == nil || !*ar2.OpponentCorrect {
		t.Fatalf("unexpected u2 answer_result: %+v", ar2)
	}

	// Round 1 question
	q1Msg := waitForEvent(t, c1, "battle:question", time.Second)
	_ = waitForEvent(t, c2, "battle:question", time.Second)
	var q1 QuestionEventPayload
	_ = json.Unmarshal(q1Msg.Data, &q1)

	correctKey1 := "A"
	for _, sq := range store.questions {
		if sq.QuestionID == q1.Question.QuestionID {
			correctKey1 = sq.CorrectOptionKey()
		}
	}
	wrongKey1 := "D"
	if correctKey1 == "D" {
		wrongKey1 = "C"
	}

	ans1R1, _ := json.Marshal(map[string]any{"roomCode": m1.RoomCode, "roundIndex": 1, "optionKey": correctKey1, "idempotencyKey": "pvp-u1-r1"})
	ans2R1, _ := json.Marshal(map[string]any{"roomCode": m1.RoomCode, "roundIndex": 1, "optionKey": wrongKey1, "idempotencyKey": "pvp-u2-r1"})
	bh.HandleMessage(c1, &Message{Event: "battle:pvp_answer", Data: ans1R1})
	bh.HandleMessage(c2, &Message{Event: "battle:pvp_answer", Data: ans2R1})

	fin1Msg := waitForEvent(t, c1, "battle:finished", time.Second)
	fin2Msg := waitForEvent(t, c2, "battle:finished", time.Second)
	var f1, f2 FinishedEventPayload
	_ = json.Unmarshal(fin1Msg.Data, &f1)
	_ = json.Unmarshal(fin2Msg.Data, &f2)
	if f1.Outcome != "win" || f2.Outcome != "lose" {
		t.Fatalf("expected u1 win and u2 lose, got f1=%+v f2=%+v", f1, f2)
	}
}

func TestBattleEngine_PvpForfeitAndResync(t *testing.T) {
	hub, bh, _ := newTestBattleEngine()
	u1 := "11111111-1111-4111-8111-111111111111"
	u2 := "22222222-2222-4222-8222-222222222222"
	c1 := newTestBattleConn(hub, bh, "c-forf-1", u1, "One")
	c2 := newTestBattleConn(hub, bh, "c-forf-2", u2, "Two")

	bh.HandleMessage(c1, &Message{Event: "battle:lobby_join", Data: []byte(`{}`)})
	bh.HandleMessage(c2, &Message{Event: "battle:lobby_join", Data: []byte(`{}`)})
	_ = waitForEvent(t, c1, "battle:lobby_joined", time.Second)
	_ = waitForEvent(t, c2, "battle:lobby_joined", time.Second)

	rawChal, _ := json.Marshal(map[string]any{"targetUserId": u2})
	bh.HandleMessage(c1, &Message{Event: "battle:challenge_user", Data: rawChal})
	recvMsg := waitForEvent(t, c2, "battle:user_challenge_received", time.Second)
	var recv struct {
		ChallengeID string `json:"challengeId"`
	}
	_ = json.Unmarshal(recvMsg.Data, &recv)

	rawAcc, _ := json.Marshal(map[string]any{"challengeId": recv.ChallengeID, "fromUserId": u1})
	bh.HandleMessage(c2, &Message{Event: "battle:accept_challenge", Data: rawAcc})
	m1Msg := waitForEvent(t, c1, "battle:pvp_match_found", time.Second)
	var m1 PvpMatchFoundPayload
	_ = json.Unmarshal(m1Msg.Data, &m1)
	_ = waitForEvent(t, c1, "battle:question", time.Second)

	// Re-joining lobby while in active PvP match emits battle:pvp_resync
	bh.HandleMessage(c1, &Message{Event: "battle:lobby_join", Data: []byte(`{}`)})
	resyncMsg := waitForEvent(t, c1, "battle:pvp_resync", time.Second)
	var resync PvpResyncPayload
	_ = json.Unmarshal(resyncMsg.Data, &resync)
	if resync.RoomCode != m1.RoomCode || resync.OpponentDisplayName != "Two" {
		t.Fatalf("unexpected pvp_resync payload: %+v", resync)
	}

	// u2 forfeits
	rawForf, _ := json.Marshal(map[string]any{"roomCode": m1.RoomCode})
	bh.HandleMessage(c2, &Message{Event: "battle:pvp_forfeit", Data: rawForf})

	fin1Msg := waitForEvent(t, c1, "battle:finished", time.Second)
	fin2Msg := waitForEvent(t, c2, "battle:finished", time.Second)
	var f1, f2 FinishedEventPayload
	_ = json.Unmarshal(fin1Msg.Data, &f1)
	_ = json.Unmarshal(fin2Msg.Data, &f2)
	if f1.Outcome != "win" || f1.PvpEndReason != "opponent_quit" {
		t.Fatalf("expected u1 win by opponent_quit, got %+v", f1)
	}
	if f2.Outcome != "lose" || f2.PvpEndReason != "self_quit" {
		t.Fatalf("expected u2 lose by self_quit, got %+v", f2)
	}
}

func TestBattleEngine_LobbyChatAndRateLimit(t *testing.T) {
	hub, bh, _ := newTestBattleEngine()
	u1 := "11111111-1111-4111-8111-111111111111"
	u2 := "22222222-2222-4222-8222-222222222222"
	c1 := newTestBattleConn(hub, bh, "c-chat-1", u1, "ChatOne")
	c2 := newTestBattleConn(hub, bh, "c-chat-2", u2, "ChatTwo")

	bh.HandleMessage(c1, &Message{Event: "battle:lobby_join", Data: []byte(`{}`)})
	bh.HandleMessage(c2, &Message{Event: "battle:lobby_join", Data: []byte(`{}`)})
	_ = waitForEvent(t, c1, "battle:lobby_joined", time.Second)
	_ = waitForEvent(t, c2, "battle:lobby_joined", time.Second)

	for i := 0; i < lobbyChatWindowLimit; i++ {
		raw, _ := json.Marshal(map[string]any{"message": "hello lobby"})
		bh.HandleMessage(c1, &Message{Event: "battle:lobby_message", Data: raw})
		got := waitForEvent(t, c2, "battle:lobby_message", time.Second)
		if !strings.Contains(string(got.Data), "hello lobby") {
			t.Fatalf("unexpected lobby_message on c2: %s", string(got.Data))
		}
	}

	// 6th message within window must trigger rate_limited
	raw6, _ := json.Marshal(map[string]any{"message": "spam 6"})
	bh.HandleMessage(c1, &Message{Event: "battle:lobby_message", Data: raw6})
	errMsg := waitForEvent(t, c1, "battle:lobby_error", time.Second)
	if !strings.Contains(string(errMsg.Data), "rate_limited") {
		t.Fatalf("expected rate_limited error on 6th message, got %s", string(errMsg.Data))
	}
}

func TestBattleEngine_PvpDisconnectGraceAwardsWinToRemainingPlayer(t *testing.T) {
	hub, bh, store := newTestBattleEngine()
	bh.timings.PvpOpponentAbsentWin = 40 * time.Millisecond
	u1 := "11111111-1111-4111-8111-111111111111"
	u2 := "22222222-2222-4222-8222-222222222222"
	c1 := newTestBattleConn(hub, bh, "c-grace-1", u1, "One")
	c2 := newTestBattleConn(hub, bh, "c-grace-2", u2, "Two")

	bh.HandleMessage(c1, &Message{Event: "battle:lobby_join", Data: []byte(`{}`)})
	bh.HandleMessage(c2, &Message{Event: "battle:lobby_join", Data: []byte(`{}`)})
	_ = waitForEvent(t, c1, "battle:lobby_joined", time.Second)
	_ = waitForEvent(t, c2, "battle:lobby_joined", time.Second)

	rawChal, _ := json.Marshal(map[string]any{"targetUserId": u2})
	bh.HandleMessage(c1, &Message{Event: "battle:challenge_user", Data: rawChal})
	recvMsg := waitForEvent(t, c2, "battle:user_challenge_received", time.Second)
	var recv struct {
		ChallengeID string `json:"challengeId"`
	}
	_ = json.Unmarshal(recvMsg.Data, &recv)
	rawAcc, _ := json.Marshal(map[string]any{"challengeId": recv.ChallengeID, "fromUserId": u1})
	bh.HandleMessage(c2, &Message{Event: "battle:accept_challenge", Data: rawAcc})
	matchMsg := waitForEvent(t, c1, "battle:pvp_match_found", time.Second)
	var match PvpMatchFoundPayload
	_ = json.Unmarshal(matchMsg.Data, &match)
	_ = waitForEvent(t, c1, "battle:question", time.Second)

	// u2 drops without forfeiting; u1 stays connected and wins once the grace period lapses.
	hub.Unregister(c2.ID)
	bh.OnDisconnect(c2)

	finMsg := waitForEvent(t, c1, "battle:finished", 2*time.Second)
	var fin FinishedEventPayload
	if err := json.Unmarshal(finMsg.Data, &fin); err != nil {
		t.Fatalf("unmarshal finished: %v", err)
	}
	if fin.Outcome != "win" {
		t.Fatalf("remaining player must win after the opponent's grace lapses, got %+v", fin)
	}
	store.mu.Lock()
	reason := store.abandonedSessions[match.SessionID]
	store.mu.Unlock()
	if reason == "" {
		t.Fatalf("expected the forfeited session %s to be persisted as abandoned", match.SessionID)
	}
}
