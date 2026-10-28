package realtime

// Identity and authorization contracts of the battle engine. Every check here
// derives the acting user from the connection, never from the payload; deleting
// any of them must turn one of these tests red.

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

const (
	secUser1 = "11111111-1111-4111-8111-111111111111"
	secUser2 = "22222222-2222-4222-8222-222222222222"
	secUser3 = "33333333-3333-4333-8333-333333333333"
)

type pvpFixture struct {
	bh         *BattleHandler
	store      *fakeBattleStore
	c1, c2, c3 *Conn
}

func newPvpFixture(t *testing.T) *pvpFixture {
	t.Helper()
	hub, bh, store := newTestBattleEngine()
	f := &pvpFixture{
		bh: bh, store: store,
		c1: newTestBattleConn(hub, bh, "sec-1", secUser1, "One"),
		c2: newTestBattleConn(hub, bh, "sec-2", secUser2, "Two"),
		c3: newTestBattleConn(hub, bh, "sec-3", secUser3, "Three"),
	}
	for _, c := range []*Conn{f.c1, f.c2, f.c3} {
		bh.HandleMessage(c, &Message{Event: "battle:lobby_join", Data: []byte(`{}`)})
		_ = waitForEvent(t, c, "battle:lobby_joined", time.Second)
	}
	return f
}

func (f *pvpFixture) send(c *Conn, event string, data any) {
	raw, _ := json.Marshal(data)
	f.bh.HandleMessage(c, &Message{Event: event, Data: raw})
}

// challenge makes c1 challenge u2 and returns the challenge id.
func (f *pvpFixture) challenge(t *testing.T) string {
	t.Helper()
	f.send(f.c1, "battle:challenge_user", map[string]any{"targetUserId": secUser2})
	msg := waitForEvent(t, f.c2, "battle:user_challenge_received", time.Second)
	var recv struct {
		ChallengeID string `json:"challengeId"`
	}
	if err := json.Unmarshal(msg.Data, &recv); err != nil || recv.ChallengeID == "" {
		t.Fatalf("challenge_received payload: %s (%v)", msg.Data, err)
	}
	return recv.ChallengeID
}

// startMatch runs challenge+accept and returns the room code once both players hold question 0.
func (f *pvpFixture) startMatch(t *testing.T) (roomCode string, q1, q2 QuestionEventPayload) {
	t.Helper()
	id := f.challenge(t)
	f.send(f.c2, "battle:accept_challenge", map[string]any{"challengeId": id, "fromUserId": secUser1})
	found := waitForEvent(t, f.c1, "battle:pvp_match_found", time.Second)
	var mf PvpMatchFoundPayload
	if err := json.Unmarshal(found.Data, &mf); err != nil {
		t.Fatalf("pvp_match_found: %v", err)
	}
	m1 := waitForEvent(t, f.c1, "battle:question", time.Second)
	m2 := waitForEvent(t, f.c2, "battle:question", time.Second)
	if err := json.Unmarshal(m1.Data, &q1); err != nil {
		t.Fatalf("question c1: %v", err)
	}
	if err := json.Unmarshal(m2.Data, &q2); err != nil {
		t.Fatalf("question c2: %v", err)
	}
	return mf.RoomCode, q1, q2
}

// expectNoEvent fails if c receives event within d.
func expectNoEvent(t *testing.T, c *Conn, event string, d time.Duration) {
	t.Helper()
	deadline := time.After(d)
	for {
		select {
		case raw := <-c.Send:
			if msg, err := Decode(raw); err == nil && msg.Event == event {
				t.Fatalf("conn %s unexpectedly received %s: %s", c.ID, event, msg.Data)
			}
		case <-deadline:
			return
		}
	}
}

func TestBattlePvp_ChallengeAcceptRejectsNonTargetAndWrongChallenger(t *testing.T) {
	f := newPvpFixture(t)
	id := f.challenge(t)

	// An outsider cannot accept someone else's challenge.
	f.send(f.c3, "battle:accept_challenge", map[string]any{"challengeId": id, "fromUserId": secUser1})
	if e := waitForEvent(t, f.c3, "battle:lobby_error", time.Second); !strings.Contains(string(e.Data), "challenge_mismatch") {
		t.Fatalf("outsider accept = %s, want challenge_mismatch", e.Data)
	}
	// The real target cannot accept with a forged challenger id.
	f.send(f.c2, "battle:accept_challenge", map[string]any{"challengeId": id, "fromUserId": secUser3})
	if e := waitForEvent(t, f.c2, "battle:lobby_error", time.Second); !strings.Contains(string(e.Data), "challenge_mismatch") {
		t.Fatalf("forged fromUserId accept = %s, want challenge_mismatch", e.Data)
	}
	expectNoEvent(t, f.c1, "battle:pvp_match_found", 50*time.Millisecond)

	// Both failed attempts left the challenge intact: the legitimate accept still works.
	f.send(f.c2, "battle:accept_challenge", map[string]any{"challengeId": id, "fromUserId": secUser1})
	_ = waitForEvent(t, f.c1, "battle:pvp_match_found", time.Second)
}

func TestBattlePvp_DeclineOnlyByTargetAndConsumesChallenge(t *testing.T) {
	f := newPvpFixture(t)
	id := f.challenge(t)

	// A non-target decline is ignored and does not consume the challenge.
	f.send(f.c3, "battle:decline_challenge", map[string]any{"challengeId": id, "fromUserId": secUser1})
	expectNoEvent(t, f.c1, "battle:challenge_declined", 50*time.Millisecond)

	f.send(f.c2, "battle:decline_challenge", map[string]any{"challengeId": id, "fromUserId": secUser1})
	declined := waitForEvent(t, f.c1, "battle:challenge_declined", time.Second)
	var d struct {
		ChallengeID  string `json:"challengeId"`
		TargetUserID string `json:"targetUserId"`
	}
	if err := json.Unmarshal(declined.Data, &d); err != nil || d.ChallengeID != id || d.TargetUserID != secUser2 {
		t.Fatalf("declined payload = %s (%v)", declined.Data, err)
	}

	// A declined challenge can no longer be accepted.
	f.send(f.c2, "battle:accept_challenge", map[string]any{"challengeId": id, "fromUserId": secUser1})
	if e := waitForEvent(t, f.c2, "battle:lobby_error", time.Second); !strings.Contains(string(e.Data), "challenge_expired") {
		t.Fatalf("accept after decline = %s, want challenge_expired", e.Data)
	}
}

func TestBattlePvp_AnswerIdentityAndSynchronizedQuestions(t *testing.T) {
	f := newPvpFixture(t)
	room, q1, q2 := f.startMatch(t)

	if q1.Question.QuestionID == "" || q1.Question.QuestionID != q2.Question.QuestionID || q1.RoundIndex != 0 || q2.RoundIndex != 0 {
		t.Fatalf("players must receive the same round-0 question: %+v vs %+v", q1, q2)
	}
	if raw, _ := json.Marshal(q1); strings.Contains(string(raw), "isCorrect") {
		t.Fatalf("pvp question leaked the answer key: %s", raw)
	}

	answer := func(c *Conn, data map[string]any) {
		base := map[string]any{"roomCode": room, "roundIndex": 0, "optionKey": "A", "idempotencyKey": "k-" + c.ID}
		for k, v := range data {
			base[k] = v
		}
		f.send(c, "battle:pvp_answer", base)
	}

	// A non-member cannot answer, and a member cannot answer as someone else.
	answer(f.c3, nil)
	if e := waitForEvent(t, f.c3, "battle:error", time.Second); !strings.Contains(string(e.Data), "user_mismatch") {
		t.Fatalf("outsider pvp_answer = %s, want user_mismatch", e.Data)
	}
	answer(f.c1, map[string]any{"userId": secUser2})
	if e := waitForEvent(t, f.c1, "battle:error", time.Second); !strings.Contains(string(e.Data), "user_mismatch") {
		t.Fatalf("spoofed userId pvp_answer = %s, want user_mismatch", e.Data)
	}
	// An option that is not on the question is rejected and records no answer.
	answer(f.c1, map[string]any{"optionKey": "Z", "idempotencyKey": "bad-opt"})
	if e := waitForEvent(t, f.c1, "battle:error", time.Second); !strings.Contains(string(e.Data), "option_mismatch") {
		t.Fatalf("invalid option = %s, want option_mismatch", e.Data)
	}

	// Valid answers from both players settle the round; each gets their own score_update.
	answer(f.c1, nil)
	answer(f.c2, map[string]any{"optionKey": "B"})
	r1 := waitForEvent(t, f.c1, "battle:answer_result", 2*time.Second)
	r2 := waitForEvent(t, f.c2, "battle:answer_result", 2*time.Second)
	var a1, a2 AnswerResultPayload
	if err := json.Unmarshal(r1.Data, &a1); err != nil {
		t.Fatalf("answer_result c1: %v", err)
	}
	if err := json.Unmarshal(r2.Data, &a2); err != nil {
		t.Fatalf("answer_result c2: %v", err)
	}
	if a1.UserCorrect == a2.UserCorrect {
		t.Fatalf("answers A and B on the same question cannot both be right/wrong: %+v %+v", a1, a2)
	}
	var s1, s2 ScoreUpdatePayload
	if err := json.Unmarshal(waitForEvent(t, f.c1, "battle:score_update", time.Second).Data, &s1); err != nil {
		t.Fatalf("score_update c1: %v", err)
	}
	if err := json.Unmarshal(waitForEvent(t, f.c2, "battle:score_update", time.Second).Data, &s2); err != nil {
		t.Fatalf("score_update c2: %v", err)
	}
	// Scores are mirrored per perspective: my score for one is the opponent score for the other.
	if s1.UserScore != s2.OpponentScore || s1.OpponentScore != s2.UserScore || s1.UserScore+s1.OpponentScore != 1 {
		t.Fatalf("score_update perspectives inconsistent: %+v vs %+v", s1, s2)
	}
}

func TestBattlePvp_ForfeitIgnoredForNonMember(t *testing.T) {
	f := newPvpFixture(t)
	room, _, _ := f.startMatch(t)

	f.send(f.c3, "battle:pvp_forfeit", map[string]any{"roomCode": room})
	expectNoEvent(t, f.c1, "battle:finished", 100*time.Millisecond)
	expectNoEvent(t, f.c2, "battle:finished", 10*time.Millisecond)
	f.store.mu.Lock()
	abandoned := len(f.store.abandonedSessions)
	f.store.mu.Unlock()
	if abandoned != 0 {
		t.Fatalf("a non-member forfeit abandoned the match (%d sessions)", abandoned)
	}
}

func TestBattleEngine_BotAnswerOptionAndPayloadIdentityChecks(t *testing.T) {
	hub, bh, store := newTestBattleEngine()
	c := newTestBattleConn(hub, bh, "bot-sec-1", secUser1, "One")
	raw, _ := json.Marshal(map[string]any{"botKey": "bot_j1"})
	bh.HandleMessage(c, &Message{Event: "battle:challenge_bot", Data: raw})
	found := waitForEvent(t, c, "battle:match_found", time.Second)
	var mf struct {
		RoomCode  string `json:"roomCode"`
		SessionID string `json:"sessionId"`
	}
	_ = json.Unmarshal(found.Data, &mf)
	_ = waitForEvent(t, c, "battle:question", time.Second)

	answer := func(extra map[string]any) {
		base := map[string]any{"roomCode": mf.RoomCode, "roundIndex": 0, "optionKey": "A", "idempotencyKey": "k"}
		for k, v := range extra {
			base[k] = v
		}
		rawAns, _ := json.Marshal(base)
		bh.HandleMessage(c, &Message{Event: "battle:answer", Data: rawAns})
	}

	// Current round but an option that does not exist: the option check (not the round check) rejects it.
	answer(map[string]any{"optionKey": "Z"})
	if e := waitForEvent(t, c, "battle:error", time.Second); !strings.Contains(string(e.Data), "answer_rejected") {
		t.Fatalf("invalid option = %s, want answer_rejected", e.Data)
	}
	// Owner sending a different userId in the payload is rejected as a strike, not accepted.
	answer(map[string]any{"userId": secUser2})
	if e := waitForEvent(t, c, "battle:error", time.Second); !strings.Contains(string(e.Data), "answer_rejected") {
		t.Fatalf("payload userId mismatch = %s, want answer_rejected", e.Data)
	}
	// Two strikes so far; the third invalid attempt abandons the match.
	answer(map[string]any{"optionKey": "Z", "idempotencyKey": "k2"})
	if e := waitForEvent(t, c, "battle:error", time.Second); !strings.Contains(string(e.Data), "abuse_detected") {
		t.Fatalf("third strike = %s, want abuse_detected", e.Data)
	}
	store.mu.Lock()
	reason := store.abandonedSessions[mf.SessionID]
	store.mu.Unlock()
	if reason != "anti_abuse_threshold" {
		t.Fatalf("abandon reason = %q, want anti_abuse_threshold", reason)
	}
}

func TestBattlePvp_AnswerIsIdempotentAndKeyOnlyBurnedByAcceptedAnswer(t *testing.T) {
	f := newPvpFixture(t)
	room, _, _ := f.startMatch(t)
	answer := func(c *Conn, key, option string) {
		f.send(c, "battle:pvp_answer", map[string]any{"roomCode": room, "roundIndex": 0, "optionKey": option, "idempotencyKey": key})
	}

	// A rejected option must not consume the idempotency key: the corrected retry with the same key counts.
	answer(f.c1, "same-key", "Z")
	if e := waitForEvent(t, f.c1, "battle:error", time.Second); !strings.Contains(string(e.Data), "option_mismatch") {
		t.Fatalf("invalid option = %s, want option_mismatch", e.Data)
	}
	answer(f.c1, "same-key", "A")
	// Replays of the accepted answer (same key, new key, other option) never count twice.
	answer(f.c1, "same-key", "A")
	answer(f.c1, "other-key", "B")
	answer(f.c2, "k2", "B")

	waitForEvent(t, f.c1, "battle:answer_result", 2*time.Second)
	waitForEvent(t, f.c2, "battle:answer_result", 2*time.Second)
	f.store.mu.Lock()
	rounds := append([]PvpRoundUpdate(nil), f.store.pvpRounds...)
	f.store.mu.Unlock()
	if len(rounds) != 1 {
		t.Fatalf("round persisted %d times, want exactly once", len(rounds))
	}
	// The accepting player (c2) is the session "user"; the challenger (c1) is the opponent.
	if rounds[0].OpponentOptionKey == nil || *rounds[0].OpponentOptionKey != "A" {
		t.Fatalf("challenger's first accepted answer must win, persisted %v", rounds[0].OpponentOptionKey)
	}
	if rounds[0].UserOptionKey == nil || *rounds[0].UserOptionKey != "B" {
		t.Fatalf("acceptor's answer not persisted, got %v", rounds[0].UserOptionKey)
	}
	expectNoEvent(t, f.c1, "battle:answer_result", 100*time.Millisecond)
}

func TestBattlePvp_OversizedIdempotencyKeyAndBadChallengeTargetRejected(t *testing.T) {
	f := newPvpFixture(t)
	room, _, _ := f.startMatch(t)

	f.send(f.c1, "battle:pvp_answer", map[string]any{
		"roomCode": room, "roundIndex": 0, "optionKey": "A", "idempotencyKey": strings.Repeat("k", maxIdempotencyKeyLen+1),
	})
	if e := waitForEvent(t, f.c1, "battle:error", time.Second); !strings.Contains(string(e.Data), "invalid_payload") {
		t.Fatalf("oversized key = %s, want invalid_payload", e.Data)
	}
	f.send(f.c1, "battle:challenge_user", map[string]any{"targetUserId": "not-a-uuid"})
	if e := waitForEvent(t, f.c1, "battle:lobby_error", time.Second); !strings.Contains(string(e.Data), "invalid_payload") {
		t.Fatalf("non-uuid target = %s, want invalid_payload", e.Data)
	}
	f.send(f.c1, "battle:lobby_message", map[string]any{"message": "hi", "clientMessageId": strings.Repeat("c", maxClientMessageIDLen+1)})
	if e := waitForEvent(t, f.c1, "battle:lobby_error", time.Second); !strings.Contains(string(e.Data), "invalid_payload") {
		t.Fatalf("oversized clientMessageId = %s, want invalid_payload", e.Data)
	}
}

func TestBattleEngine_BotDuplicateAnswerCountsOnce(t *testing.T) {
	hub, bh, store := newTestBattleEngine()
	c := newTestBattleConn(hub, bh, "bot-idem-1", secUser1, "One")
	raw, _ := json.Marshal(map[string]any{"botKey": "bot_j1"})
	bh.HandleMessage(c, &Message{Event: "battle:challenge_bot", Data: raw})
	found := waitForEvent(t, c, "battle:match_found", time.Second)
	var mf struct {
		RoomCode string `json:"roomCode"`
	}
	_ = json.Unmarshal(found.Data, &mf)
	_ = waitForEvent(t, c, "battle:question", time.Second)

	for i := 0; i < 3; i++ {
		ans, _ := json.Marshal(map[string]any{"roomCode": mf.RoomCode, "roundIndex": 0, "optionKey": "A", "idempotencyKey": "dup"})
		bh.HandleMessage(c, &Message{Event: "battle:answer", Data: ans})
	}
	waitForEvent(t, c, "battle:answer_result", time.Second)
	_ = waitForEvent(t, c, "battle:question", time.Second) // round 1 is current now
	expectNoEvent(t, c, "battle:answer_result", 100*time.Millisecond)
	store.mu.Lock()
	n := len(store.botRounds)
	store.mu.Unlock()
	if n != 1 {
		t.Fatalf("duplicate answers persisted %d rounds, want 1", n)
	}
}
