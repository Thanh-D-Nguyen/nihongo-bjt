package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"nhooyr.io/websocket"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

// TestBattleChatPostBroadcastsToLobbyAndRateLimits drives the production router
// over a real HTTP server: a lobby socket receives the persisted message that a
// POST /api/battle/chat produced, and the sixth post inside the window is a 429.
func TestBattleChatPostBroadcastsToLobbyAndRateLimits(t *testing.T) {
	const origin = "http://localhost:18081"
	db := testPool(t)
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Broadcast Learner", fmt.Sprintf("battle-bcast-%s@example.test", userID[:8]), "")
	marker := "bcast-" + userID[:8]
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.battle_chat_message WHERE user_id=$1`, userID)
		_, _ = db.Exec(context.Background(), `DELETE FROM analytics.analytics_event WHERE user_id=$1::uuid AND event_name='battle_chat_rate_limited'`, userID)
	})

	sessions := session.NewStore(db)
	token := createLearnerSession(t, sessions, userID)
	router := NewRouter(Dependencies{Config: &config.Config{CORSOrigins: []string{origin}}, Logger: testLogger(), DBPool: db, SessionStore: sessions})
	ts := httptest.NewServer(router)
	t.Cleanup(ts.Close)

	dialCtx, cancelDial := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancelDial()
	header := http.Header{}
	header.Set("Cookie", "bjt_web_session="+token)
	header.Set("Origin", origin)
	conn, resp, err := websocket.Dial(dialCtx, "ws"+strings.TrimPrefix(ts.URL, "http")+"/ws/battle", &websocket.DialOptions{HTTPHeader: header})
	if resp != nil && resp.Body != nil {
		_ = resp.Body.Close()
	}
	if err != nil {
		t.Fatalf("dial /ws/battle: %v", err)
	}
	t.Cleanup(func() { _ = conn.CloseNow() })

	send := func(raw string) {
		t.Helper()
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := conn.Write(ctx, websocket.MessageText, []byte(raw)); err != nil {
			t.Fatalf("ws write: %v", err)
		}
	}
	readUntil := func(event string) json.RawMessage {
		t.Helper()
		deadline := time.Now().Add(10 * time.Second)
		for time.Now().Before(deadline) {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			_, data, err := conn.Read(ctx)
			cancel()
			if err != nil {
				t.Fatalf("waiting for %s: %v", event, err)
			}
			var msg struct {
				Event string          `json:"event"`
				Data  json.RawMessage `json:"data"`
			}
			if err := json.Unmarshal(data, &msg); err != nil {
				t.Fatalf("non-JSON ws frame %q: %v", data, err)
			}
			if msg.Event == event {
				return msg.Data
			}
		}
		t.Fatalf("timed out waiting for %s", event)
		return nil
	}

	send(`{"event":"battle:lobby_join","data":{}}`)
	readUntil("battle:lobby_joined")

	post := func(message string) (int, string) {
		t.Helper()
		req, err := http.NewRequest(http.MethodPost, ts.URL+"/api/battle/chat", strings.NewReader(`{"message":"`+message+`"}`))
		if err != nil {
			t.Fatalf("build request: %v", err)
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", origin)
		req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatalf("post chat: %v", err)
		}
		defer res.Body.Close()
		raw, _ := io.ReadAll(res.Body)
		return res.StatusCode, string(raw)
	}

	status, body := post(marker + " first")
	if status != http.StatusCreated {
		t.Fatalf("first post status=%d body=%s", status, body)
	}
	var persisted struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal([]byte(body), &persisted); err != nil || persisted.ID == "" {
		t.Fatalf("post response lacks id: %s (%v)", body, err)
	}
	var broadcast struct {
		ID      string `json:"id"`
		UserID  string `json:"userId"`
		Message string `json:"message"`
		RoomKey string `json:"roomKey"`
	}
	if err := json.Unmarshal(readUntil("battle:lobby_message"), &broadcast); err != nil {
		t.Fatalf("decode broadcast: %v", err)
	}
	if broadcast.ID != persisted.ID || broadcast.UserID != userID || broadcast.Message != marker+" first" || broadcast.RoomKey != "global" {
		t.Fatalf("broadcast does not match the persisted message: %+v vs id %s", broadcast, persisted.ID)
	}

	// The window allows 5 messages; posts 2..5 pass, the 6th is throttled and not persisted.
	for i := 2; i <= 5; i++ {
		if status, body := post(fmt.Sprintf("%s msg %d", marker, i)); status != http.StatusCreated {
			t.Fatalf("post %d status=%d body=%s", i, status, body)
		}
	}
	if status, body := post(marker + " throttled"); status != http.StatusTooManyRequests {
		t.Fatalf("sixth post status=%d body=%s, want 429", status, body)
	}
	var stored int
	if err := db.QueryRow(context.Background(),
		`SELECT count(*) FROM learning.battle_chat_message WHERE user_id=$1 AND message LIKE $2`, userID, marker+"%").Scan(&stored); err != nil {
		t.Fatalf("count stored: %v", err)
	}
	if stored != 5 {
		t.Fatalf("stored messages = %d, want 5 (throttled post must not persist)", stored)
	}
}
