package httpserver

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/realtime"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
	"github.com/redis/go-redis/v9"
	"nhooyr.io/websocket"
)

func TestRealtimePresenceRouterTracksAuthenticatedLearner(t *testing.T) {
	db := testPool(t)
	redisURL := os.Getenv("TEST_REDIS_URL")
	if redisURL == "" {
		t.Skip("TEST_REDIS_URL not set; skipping Redis integration test")
	}
	options, err := redis.ParseURL(redisURL)
	if err != nil {
		t.Fatalf("parse TEST_REDIS_URL: %v", err)
	}
	redisClient := redis.NewClient(options)
	if err := redisClient.Ping(context.Background()).Err(); err != nil {
		t.Fatalf("ping test Redis: %v", err)
	}
	t.Cleanup(func() { _ = redisClient.Close() })

	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Presence Learner", fmt.Sprintf("presence-%s@example.com", userID[:8]), "")
	sessions := session.NewStore(db)
	rawToken := createLearnerSession(t, sessions, userID)
	presence := realtime.NewPresenceService(redisClient)
	ctx := context.Background()
	_, _ = redisClient.HDel(ctx, "presence:online", userID).Result()
	_, _ = redisClient.HDel(ctx, "presence:last_seen", userID).Result()
	t.Cleanup(func() {
		cleanupCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_, _ = redisClient.HDel(cleanupCtx, "presence:online", userID).Result()
		_, _ = redisClient.HDel(cleanupCtx, "presence:last_seen", userID).Result()
	})

	router := NewRouter(Dependencies{
		Config:          &config.Config{},
		Logger:          testLogger(),
		DBPool:          db,
		SessionStore:    sessions,
		PresenceService: presence,
	})
	ts := httptest.NewServer(router)
	defer ts.Close()

	wsURL := "ws" + strings.TrimPrefix(ts.URL, "http") + "/ws/presence"
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	conn, response, err := websocket.Dial(ctx, wsURL, &websocket.DialOptions{HTTPHeader: http.Header{"Cookie": []string{"bjt_web_session=" + rawToken}}})
	if response != nil && response.Body != nil {
		_ = response.Body.Close()
	}
	if err != nil {
		t.Fatalf("authenticated presence upgrade failed: %v", err)
	}
	defer conn.CloseNow()

	waitForPresence(t, func() bool {
		online, err := presence.IsOnline(ctx, userID)
		return err == nil && online
	}, "connected learner to be online", func() string {
		value, err := redisClient.HGet(ctx, "presence:online", userID).Result()
		return fmt.Sprintf("presence:online=%q, redis_error=%v", value, err)
	})
	before, err := redisClient.HGet(ctx, "presence:online", userID).Result()
	if err != nil {
		t.Fatalf("read initial presence timestamp: %v", err)
	}
	lastSeenBefore, err := redisClient.HGet(ctx, "presence:last_seen", userID).Result()
	if err != nil {
		t.Fatalf("read initial last-seen timestamp: %v", err)
	}
	time.Sleep(1100 * time.Millisecond)
	if err := conn.Write(ctx, websocket.MessageText, []byte(`{"event":"presence:heartbeat"}`)); err != nil {
		t.Fatalf("send heartbeat: %v", err)
	}
	waitForPresence(t, func() bool {
		after, err := redisClient.HGet(ctx, "presence:online", userID).Result()
		return err == nil && after != before
	}, "heartbeat timestamp to refresh")
	waitForPresence(t, func() bool {
		after, err := redisClient.HGet(ctx, "presence:last_seen", userID).Result()
		return err == nil && after != lastSeenBefore
	}, "heartbeat last-seen timestamp to refresh")

	if err := conn.Close(websocket.StatusNormalClosure, "audit complete"); err != nil {
		t.Fatalf("close presence connection: %v", err)
	}
	waitForPresence(t, func() bool {
		online, err := presence.IsOnline(ctx, userID)
		return err == nil && !online
	}, "last connection to mark learner offline")

}

func waitForPresence(t *testing.T, condition func() bool, description string, diagnostic ...func() string) {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if condition() {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	if len(diagnostic) > 0 {
		t.Fatalf("timed out waiting for %s: %s", description, diagnostic[0]())
	}
	t.Fatalf("timed out waiting for %s", description)
}
