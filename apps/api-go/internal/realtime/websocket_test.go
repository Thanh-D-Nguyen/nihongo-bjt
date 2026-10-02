package realtime

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"log/slog"
)

// newTestServer creates a realtime server with a nil session store for testing
// protocol-level behavior without real database dependencies.
func newTestServer() *Server {
	logger := slog.Default()
	return NewServer(nil, logger)
}

// TestBattleUpgrade_RejectsAnonymous verifies that /ws/battle returns 401
// when no valid learner session cookie is present.
func TestBattleUpgrade_RejectsAnonymous(t *testing.T) {
	srv := newTestServer()

	req := httptest.NewRequest(http.MethodGet, "/ws/battle", nil)
	rec := httptest.NewRecorder()

	srv.HandleBattleUpgrade(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for anonymous battle upgrade, got %d", rec.Code)
	}
}

// TestPresenceUpgrade_RejectsAnonymous verifies that /ws/presence returns 401
// when no valid session cookie is present.
func TestPresenceUpgrade_RejectsAnonymous(t *testing.T) {
	srv := newTestServer()

	req := httptest.NewRequest(http.MethodGet, "/ws/presence", nil)
	rec := httptest.NewRecorder()

	srv.HandlePresenceUpgrade(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for anonymous presence upgrade, got %d", rec.Code)
	}
}

// TestProtocol_EncodeDecode verifies the Message envelope round-trips correctly.
func TestProtocol_EncodeDecode(t *testing.T) {
	type payload struct {
		UserID string `json:"userId"`
		Action string `json:"action"`
	}

	data := payload{UserID: "u1", Action: "test"}
	encoded, err := Encode("battle:action", data)
	if err != nil {
		t.Fatalf("Encode failed: %v", err)
	}

	msg, err := Decode(encoded)
	if err != nil {
		t.Fatalf("Decode failed: %v", err)
	}

	if msg.Event != "battle:action" {
		t.Errorf("expected event 'battle:action', got %q", msg.Event)
	}

	var decoded payload
	if err := json.Unmarshal(msg.Data, &decoded); err != nil {
		t.Fatalf("unmarshal data failed: %v", err)
	}
	if decoded.UserID != "u1" || decoded.Action != "test" {
		t.Errorf("unexpected decoded payload: %+v", decoded)
	}
}

// TestProtocol_EncodeWithID verifies ID is preserved in the envelope.
func TestProtocol_EncodeWithID(t *testing.T) {
	encoded, err := EncodeWithID("battle:join", "ack-123", map[string]string{"room": "r1"})
	if err != nil {
		t.Fatalf("EncodeWithID failed: %v", err)
	}

	msg, err := Decode(encoded)
	if err != nil {
		t.Fatalf("Decode failed: %v", err)
	}

	if msg.ID != "ack-123" {
		t.Errorf("expected ID 'ack-123', got %q", msg.ID)
	}
}

// TestProtocol_DecodeRejectsMissingEvent verifies that messages without an
// event field are rejected.
func TestProtocol_DecodeRejectsMissingEvent(t *testing.T) {
	raw := []byte(`{"data":{"key":"value"}}`)
	_, err := Decode(raw)
	if err == nil {
		t.Fatal("expected error for missing event field, got nil")
	}
	if !strings.Contains(err.Error(), "missing event") {
		t.Errorf("expected 'missing event' error, got: %v", err)
	}
}

// TestProtocol_DecodeRejectsInvalidJSON verifies that malformed JSON is rejected.
func TestProtocol_DecodeRejectsInvalidJSON(t *testing.T) {
	_, err := Decode([]byte(`{invalid`))
	if err == nil {
		t.Fatal("expected error for invalid JSON, got nil")
	}
}

// TestHub_RegisterUnregister verifies connection lifecycle tracking.
func TestHub_RegisterUnregister(t *testing.T) {
	hub := NewHub()

	c := &Conn{
		ID:     "conn-1",
		UserID: "user-a",
		Send:   make(chan []byte, 16),
		done:   make(chan struct{}),
	}

	hub.Register(c)

	if hub.UserConnCount("user-a") != 1 {
		t.Errorf("expected 1 connection for user-a, got %d", hub.UserConnCount("user-a"))
	}

	online := hub.OnlineUsers()
	if len(online) != 1 || online[0] != "user-a" {
		t.Errorf("expected [user-a] online, got %v", online)
	}

	userID, lastForUser := hub.Unregister("conn-1")
	if userID != "user-a" {
		t.Errorf("expected userID 'user-a' on unregister, got %q", userID)
	}
	if !lastForUser {
		t.Error("expected lastForUser=true for sole connection")
	}

	if hub.UserConnCount("user-a") != 0 {
		t.Errorf("expected 0 connections after unregister, got %d", hub.UserConnCount("user-a"))
	}
}

// TestHub_MultipleConnectionsPerUser verifies that multiple connections for
// the same user are tracked and lastForUser is only true on final disconnect.
func TestHub_MultipleConnectionsPerUser(t *testing.T) {
	hub := NewHub()

	c1 := &Conn{ID: "c1", UserID: "u1", Send: make(chan []byte, 16), done: make(chan struct{})}
	c2 := &Conn{ID: "c2", UserID: "u1", Send: make(chan []byte, 16), done: make(chan struct{})}

	hub.Register(c1)
	hub.Register(c2)

	if hub.UserConnCount("u1") != 2 {
		t.Errorf("expected 2 connections, got %d", hub.UserConnCount("u1"))
	}

	_, last := hub.Unregister("c1")
	if last {
		t.Error("expected lastForUser=false when second connection remains")
	}

	_, last = hub.Unregister("c2")
	if !last {
		t.Error("expected lastForUser=true on final disconnect")
	}
}

// TestHub_SendToUser verifies unicast delivery to all of a user's connections.
func TestHub_SendToUser(t *testing.T) {
	hub := NewHub()

	c1 := &Conn{ID: "c1", UserID: "u1", Send: make(chan []byte, 16), done: make(chan struct{})}
	c2 := &Conn{ID: "c2", UserID: "u1", Send: make(chan []byte, 16), done: make(chan struct{})}
	c3 := &Conn{ID: "c3", UserID: "u2", Send: make(chan []byte, 16), done: make(chan struct{})}

	hub.Register(c1)
	hub.Register(c2)
	hub.Register(c3)

	payload := []byte(`{"event":"test","data":{"msg":"hello"}}`)
	hub.SendToUser("u1", payload)

	// Both u1 connections should receive the message.
	select {
	case msg := <-c1.Send:
		if string(msg) != string(payload) {
			t.Errorf("c1: unexpected message: %s", msg)
		}
	case <-time.After(time.Second):
		t.Error("c1: timed out waiting for message")
	}

	select {
	case msg := <-c2.Send:
		if string(msg) != string(payload) {
			t.Errorf("c2: unexpected message: %s", msg)
		}
	case <-time.After(time.Second):
		t.Error("c2: timed out waiting for message")
	}

	// u2 should NOT receive the message.
	select {
	case <-c3.Send:
		t.Error("c3: should not have received unicast to u1")
	case <-time.After(100 * time.Millisecond):
		// expected
	}
}

// TestHub_BroadcastExcept verifies broadcast excludes the specified connection.
func TestHub_BroadcastExcept(t *testing.T) {
	hub := NewHub()

	c1 := &Conn{ID: "c1", UserID: "u1", Send: make(chan []byte, 16), done: make(chan struct{})}
	c2 := &Conn{ID: "c2", UserID: "u2", Send: make(chan []byte, 16), done: make(chan struct{})}

	hub.Register(c1)
	hub.Register(c2)

	payload := []byte(`{"event":"broadcast"}`)
	hub.BroadcastExcept("c1", payload)

	// c1 should NOT receive.
	select {
	case <-c1.Send:
		t.Error("c1: should have been excluded from broadcast")
	case <-time.After(100 * time.Millisecond):
		// expected
	}

	// c2 should receive.
	select {
	case msg := <-c2.Send:
		if string(msg) != string(payload) {
			t.Errorf("c2: unexpected message: %s", msg)
		}
	case <-time.After(time.Second):
		t.Error("c2: timed out waiting for broadcast")
	}
}

// TestBattleHandler_JoinBroadcastsPlayerJoined verifies that a battle:join
// message results in a battle:player_joined broadcast.
func TestBattleHandler_JoinBroadcastsPlayerJoined(t *testing.T) {
	hub := NewHub()
	logger := slog.Default()
	handler := NewBattleHandler(hub, logger)

	c := &Conn{ID: "bc1", UserID: "u1", Send: make(chan []byte, 16), done: make(chan struct{})}
	hub.Register(c)

	// Create another connection to receive the broadcast.
	c2 := &Conn{ID: "bc2", UserID: "u2", Send: make(chan []byte, 16), done: make(chan struct{})}
	hub.Register(c2)

	joinMsg := &Message{Event: "battle:join"}
	handler.HandleMessage(c, joinMsg)

	// c2 should receive battle:player_joined.
	select {
	case raw := <-c2.Send:
		msg, err := Decode(raw)
		if err != nil {
			t.Fatalf("decode broadcast: %v", err)
		}
		if msg.Event != "battle:player_joined" {
			t.Errorf("expected 'battle:player_joined', got %q", msg.Event)
		}
	case <-time.After(time.Second):
		t.Error("timed out waiting for player_joined broadcast")
	}
}

// TestBattleHandler_ActionAcknowledges verifies that battle:action produces
// a battle:action_ack sent back to the originating connection.
func TestBattleHandler_ActionAcknowledges(t *testing.T) {
	hub := NewHub()
	logger := slog.Default()
	handler := NewBattleHandler(hub, logger)

	c := &Conn{ID: "bc1", UserID: "u1", Send: make(chan []byte, 16), done: make(chan struct{})}
	hub.Register(c)

	actionData, _ := json.Marshal(map[string]string{"answer": "A"})
	actionMsg := &Message{Event: "battle:action", Data: actionData}
	handler.HandleMessage(c, actionMsg)

	select {
	case raw := <-c.Send:
		msg, err := Decode(raw)
		if err != nil {
			t.Fatalf("decode ack: %v", err)
		}
		if msg.Event != "battle:action_ack" {
			t.Errorf("expected 'battle:action_ack', got %q", msg.Event)
		}
		var ack map[string]any
		if err := json.Unmarshal(msg.Data, &ack); err != nil {
			t.Fatalf("unmarshal ack data: %v", err)
		}
		if ack["userId"] != "u1" {
			t.Errorf("expected userId 'u1' in ack, got %v", ack["userId"])
		}
		if _, ok := ack["serverTs"]; !ok {
			t.Error("expected serverTs in ack")
		}
	case <-time.After(time.Second):
		t.Error("timed out waiting for action_ack")
	}
}

// TestBattleHandler_UnknownEventIgnored verifies that unknown events do not
// crash or produce responses.
func TestBattleHandler_UnknownEventIgnored(t *testing.T) {
	hub := NewHub()
	logger := slog.Default()
	handler := NewBattleHandler(hub, logger)

	c := &Conn{ID: "bc1", UserID: "u1", Send: make(chan []byte, 16), done: make(chan struct{})}
	hub.Register(c)

	unknownMsg := &Message{Event: "battle:nonexistent_event"}
	handler.HandleMessage(c, unknownMsg)

	// No response should be sent for unknown events.
	select {
	case <-c.Send:
		t.Error("unexpected response for unknown event")
	case <-time.After(200 * time.Millisecond):
		// expected — no response
	}
}

// TestPresenceHandler_UnknownEventReturnsError verifies that unknown presence
// events produce a presence:error response.
func TestPresenceHandler_UnknownEventReturnsError(t *testing.T) {
	hub := NewHub()
	logger := slog.Default()
	handler := NewPresenceHandler(hub, logger)
	// No service attached — tests protocol behavior only.

	c := &Conn{ID: "pc1", UserID: "u1", Send: make(chan []byte, 16), done: make(chan struct{})}
	hub.Register(c)

	unknownMsg := &Message{Event: "presence:nonexistent"}
	handler.HandleMessage(c, unknownMsg)

	select {
	case raw := <-c.Send:
		msg, err := Decode(raw)
		if err != nil {
			t.Fatalf("decode error response: %v", err)
		}
		if msg.Event != "presence:error" {
			t.Errorf("expected 'presence:error', got %q", msg.Event)
		}
		var ep ErrorPayload
		if err := json.Unmarshal(msg.Data, &ep); err != nil {
			t.Fatalf("unmarshal error payload: %v", err)
		}
		if !strings.Contains(ep.Message, "unknown event") {
			t.Errorf("expected 'unknown event' in message, got %q", ep.Message)
		}
	case <-time.After(time.Second):
		t.Error("timed out waiting for presence:error response")
	}
}

// TestPresenceHandler_QueryRejectsEmptyUserIDs verifies that presence:query
// with empty userIds returns an error.
func TestPresenceHandler_QueryRejectsEmptyUserIDs(t *testing.T) {
	hub := NewHub()
	logger := slog.Default()
	handler := NewPresenceHandler(hub, logger)

	c := &Conn{ID: "pc1", UserID: "u1", Send: make(chan []byte, 16), done: make(chan struct{})}
	hub.Register(c)

	queryData, _ := json.Marshal(map[string]any{"userIds": []string{}})
	queryMsg := &Message{Event: "presence:query", Data: queryData}
	handler.HandleMessage(c, queryMsg)

	select {
	case raw := <-c.Send:
		msg, err := Decode(raw)
		if err != nil {
			t.Fatalf("decode: %v", err)
		}
		if msg.Event != "presence:error" {
			t.Errorf("expected 'presence:error' for empty userIds, got %q", msg.Event)
		}
	case <-time.After(time.Second):
		t.Error("timed out waiting for error response")
	}
}

// TestPresenceHandler_QueryRejectsExcessiveUserIDs verifies the 50-user limit.
func TestPresenceHandler_QueryRejectsExcessiveUserIDs(t *testing.T) {
	hub := NewHub()
	logger := slog.Default()
	handler := NewPresenceHandler(hub, logger)

	c := &Conn{ID: "pc1", UserID: "u1", Send: make(chan []byte, 16), done: make(chan struct{})}
	hub.Register(c)

	ids := make([]string, 51)
	for i := range ids {
		ids[i] = "user-" + strings.Repeat("0", 5)
	}
	queryData, _ := json.Marshal(map[string]any{"userIds": ids})
	queryMsg := &Message{Event: "presence:query", Data: queryData}
	handler.HandleMessage(c, queryMsg)

	select {
	case raw := <-c.Send:
		msg, err := Decode(raw)
		if err != nil {
			t.Fatalf("decode: %v", err)
		}
		if msg.Event != "presence:error" {
			t.Errorf("expected 'presence:error' for >50 userIds, got %q", msg.Event)
		}
		var ep ErrorPayload
		json.Unmarshal(msg.Data, &ep)
		if !strings.Contains(ep.Message, "limited to 50") {
			t.Errorf("expected 'limited to 50' message, got %q", ep.Message)
		}
	case <-time.After(time.Second):
		t.Error("timed out waiting for error response")
	}
}

// TestPresenceHandler_QueryWithoutServiceReturnsOffline verifies graceful
// degradation when Redis is unavailable (service is nil).
func TestPresenceHandler_QueryWithoutServiceReturnsOffline(t *testing.T) {
	hub := NewHub()
	logger := slog.Default()
	handler := NewPresenceHandler(hub, logger)
	// service is nil — simulates no Redis.

	c := &Conn{ID: "pc1", UserID: "u1", Send: make(chan []byte, 16), done: make(chan struct{})}
	hub.Register(c)

	queryData, _ := json.Marshal(map[string]any{"userIds": []string{"u2", "u3"}})
	queryMsg := &Message{Event: "presence:query", Data: queryData}
	handler.HandleMessage(c, queryMsg)

	select {
	case raw := <-c.Send:
		msg, err := Decode(raw)
		if err != nil {
			t.Fatalf("decode: %v", err)
		}
		if msg.Event != "presence:query_result" {
			t.Errorf("expected 'presence:query_result', got %q", msg.Event)
		}
		var result map[string]PresenceInfo
		if err := json.Unmarshal(msg.Data, &result); err != nil {
			t.Fatalf("unmarshal result: %v", err)
		}
		for uid, info := range result {
			if info.Online {
				t.Errorf("expected offline for %s without service, got online", uid)
			}
		}
	case <-time.After(time.Second):
		t.Error("timed out waiting for query_result")
	}
}

// TestAuthenticateRequest_NilStore verifies nil safety.
func TestAuthenticateRequest_NilStore(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	user := AuthenticateRequest(context.Background(), req, nil)
	if user != nil {
		t.Error("expected nil user with nil store")
	}
}

// TestAuthenticateBattleRequest_NilStore verifies nil safety.
func TestAuthenticateBattleRequest_NilStore(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	user := AuthenticateBattleRequest(context.Background(), req, nil)
	if user != nil {
		t.Error("expected nil user with nil store")
	}
}

// TestExtractOrigin verifies Origin header extraction.
func TestExtractOrigin(t *testing.T) {
	tests := []struct {
		name     string
		origin   string
		expected string
	}{
		{"present", "http://localhost:3000", "http://localhost:3000"},
		{"absent", "", ""},
		{"whitespace", "  http://example.com  ", "http://example.com"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			if tt.origin != "" {
				req.Header.Set("Origin", tt.origin)
			}
			got := extractOrigin(req)
			if got != tt.expected {
				t.Errorf("extractOrigin: got %q, want %q", got, tt.expected)
			}
		})
	}
}

// TestDefaultBots verifies bot profiles match the shared package contract.
func TestDefaultBots(t *testing.T) {
	bots := DefaultBots()
	expectedKeys := []string{"bot_j1", "bot_j2", "bot_j3", "bot_j4"}

	if len(bots) != len(expectedKeys) {
		t.Errorf("expected %d bots, got %d", len(expectedKeys), len(bots))
	}

	for _, key := range expectedKeys {
		bot, ok := bots[key]
		if !ok {
			t.Errorf("missing expected bot %q", key)
			continue
		}
		if bot.CorrectProbability <= 0 || bot.CorrectProbability > 1 {
			t.Errorf("bot %s: invalid probability %f", key, bot.CorrectProbability)
		}
		if bot.DelayMinMs <= 0 || bot.DelayMaxMs <= 0 {
			t.Errorf("bot %s: invalid delays min=%d max=%d", key, bot.DelayMinMs, bot.DelayMaxMs)
		}
		if bot.DelayMinMs > bot.DelayMaxMs {
			t.Errorf("bot %s: min delay %d > max delay %d", key, bot.DelayMinMs, bot.DelayMaxMs)
		}
	}
}

// NOTE: The tests in this file are unit/component tests that call handlers and
// the hub directly. Real WebSocket upgrades over a loopback httptest.Server —
// cookie auth, Origin policy, wire protocol, lifecycle/teardown, concurrency —
// are in upgrade_integration_test.go.
