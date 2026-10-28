package realtime

// End-to-end battle over a real WebSocket upgrade: production routes, cookie
// auth, the BattleHandler engine and PostgresBattleStore all run for real.

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"nhooyr.io/websocket"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func fastBattleTimings() BattleTimings {
	return BattleTimings{
		InitialCountdownStep: 1 * time.Millisecond,
		InterCountdownStep:   1 * time.Millisecond,
		RoundTimeout:         5 * time.Second,
		ChallengeExpiry:      5 * time.Second,
		PvpReconnectGrace:    5 * time.Second,
		PvpOpponentAbsentWin: 5 * time.Second,
		BotDelayScale:        -1,
	}
}

// readUntilEvent reads frames until want arrives and returns it with its raw
// frame; frames for other events are skipped.
func readUntilEvent(t *testing.T, c *websocket.Conn, want string) (Message, []byte) {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		_, data, err := c.Read(ctx)
		cancel()
		if err != nil {
			t.Fatalf("waiting for %q: %v", want, err)
		}
		var msg Message
		if err := json.Unmarshal(data, &msg); err != nil {
			t.Fatalf("non-JSON frame %q: %v", data, err)
		}
		if msg.Event == want {
			return msg, data
		}
	}
	t.Fatalf("timed out waiting for %q", want)
	return Message{}, nil
}

func TestRealUpgrade_BattleBotMatchEndToEnd(t *testing.T) {
	db := realtimeTestPool(t)
	sessStore := session.NewStore(db)
	seedPublishedBattleQuestions(t, db, 2)
	f := newUpgradeFixture(t, sessStore)
	f.srv.SetBattleStore(NewPostgresBattleStore(db))
	f.srv.BattleHandler().timings = fastBattleTimings()
	userID, raw := seedLearnerSession(t, db, sessStore)
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.battle_session WHERE user_id = $1::uuid`, userID)
		_, _ = db.Exec(context.Background(), `DELETE FROM analytics.analytics_event WHERE user_id = $1::uuid`, userID)
	})

	conn, resp, err := f.dial(t, "/ws/battle", cookieHeader("bjt_web_session", raw, trustedTestOrigin))
	requireUpgraded(t, resp, err)

	// Spoofed identity in the payload must be ignored: the session user owns the match.
	writeEvent(t, conn, `{"event":"battle:challenge_bot","data":{"botKey":"bot_j1","userId":"spoofed"}}`)
	found, _ := readUntilEvent(t, conn, "battle:match_found")
	var mf struct {
		RoomCode  string `json:"roomCode"`
		SessionID string `json:"sessionId"`
		MaxRounds int    `json:"maxRounds"`
	}
	if err := json.Unmarshal(found.Data, &mf); err != nil {
		t.Fatalf("decode match_found: %v", err)
	}
	if mf.RoomCode == "" || mf.SessionID == "" || mf.MaxRounds < 1 {
		t.Fatalf("unexpected match_found: %s", found.Data)
	}
	var ownerID string
	if err := db.QueryRow(context.Background(),
		`SELECT user_id::text FROM learning.battle_session WHERE id = $1::uuid`, mf.SessionID).Scan(&ownerID); err != nil || ownerID != userID {
		t.Fatalf("session owner = %q (err %v), want %q", ownerID, err, userID)
	}

	for round := 0; round < mf.MaxRounds; round++ {
		q, rawFrame := readUntilEvent(t, conn, "battle:question")
		if s := string(rawFrame); strings.Contains(s, "isCorrect") || strings.Contains(s, "correctOptionKey") {
			t.Fatalf("question frame leaked the answer key: %s", s)
		}
		var qp QuestionEventPayload
		if err := json.Unmarshal(q.Data, &qp); err != nil || qp.RoundIndex != round {
			t.Fatalf("question %d payload = %s (err %v)", round, q.Data, err)
		}
		// Answering a round that is not current must be rejected without advancing.
		if round == 0 {
			writeEvent(t, conn, `{"event":"battle:answer","data":{"roomCode":"`+mf.RoomCode+`","roundIndex":99,"optionKey":"A","idempotencyKey":"bad-`+mf.RoomCode+`"}}`)
		}
		writeEvent(t, conn, `{"event":"battle:answer","data":{"roomCode":"`+mf.RoomCode+`","roundIndex":`+itoa(round)+`,"optionKey":"A","idempotencyKey":"ok-`+itoa(round)+`"}}`)
		res, _ := readUntilEvent(t, conn, "battle:answer_result")
		var ar AnswerResultPayload
		if err := json.Unmarshal(res.Data, &ar); err != nil || ar.RoundIndex != round {
			t.Fatalf("answer_result %d = %s (err %v)", round, res.Data, err)
		}
	}

	fin, _ := readUntilEvent(t, conn, "battle:finished")
	var fp FinishedEventPayload
	if err := json.Unmarshal(fin.Data, &fp); err != nil || fp.SessionID != mf.SessionID {
		t.Fatalf("finished = %s (err %v)", fin.Data, err)
	}

	var status string
	var userScore, decided, correct int
	if err := db.QueryRow(context.Background(),
		`SELECT status, user_score FROM learning.battle_session WHERE id = $1::uuid`, mf.SessionID).Scan(&status, &userScore); err != nil {
		t.Fatalf("read session: %v", err)
	}
	if err := db.QueryRow(context.Background(),
		`SELECT count(*) FROM learning.battle_round WHERE session_id = $1::uuid AND decided_at IS NOT NULL`, mf.SessionID).Scan(&decided); err != nil {
		t.Fatalf("read rounds: %v", err)
	}
	if err := db.QueryRow(context.Background(),
		`SELECT count(*) FROM learning.battle_round WHERE session_id = $1::uuid AND user_correct IS TRUE`, mf.SessionID).Scan(&correct); err != nil {
		t.Fatalf("read correct rounds: %v", err)
	}
	if status != "completed" || decided != mf.MaxRounds || userScore != correct {
		t.Fatalf("persisted session = %s score %d correct %d decided %d, want completed/score==correct/%d decided", status, userScore, correct, decided, mf.MaxRounds)
	}
}

func itoa(n int) string {
	b, _ := json.Marshal(n)
	return string(b)
}
