package realtime

// Real WebSocket upgrade tests: every test here dials a loopback
// httptest.Server through the production router wiring (MountRoutes →
// LearnerGuard → Handle*Upgrade → websocket.Accept → read/write loops).
// Nothing is invoked directly, so the HTTP upgrade boundary, cookie auth,
// Origin policy, wire protocol, and connection lifecycle are all exercised.
//
// Tests that need an authenticated session use a real PostgreSQL via
// TEST_DATABASE_URL (same convention as internal/session and
// internal/httpserver); CI provisions it.

import (
	"context"
	crand "crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"nhooyr.io/websocket"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

const (
	trustedTestOrigin   = "https://app.example.com"
	untrustedTestOrigin = "https://evil.example.net"
)

type upgradeFixture struct {
	srv *Server
	ts  *httptest.Server
}

// newUpgradeFixture mounts the production realtime routes on a loopback server.
func newUpgradeFixture(t *testing.T, store *session.Store) *upgradeFixture {
	t.Helper()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	srv := NewServer(store, logger)
	r := chi.NewRouter()
	MountRoutes(r, store, srv, authn.CSRFConfig{TrustedOrigins: []string{trustedTestOrigin}, Logger: logger})
	ts := httptest.NewServer(r)
	t.Cleanup(ts.Close)
	return &upgradeFixture{srv: srv, ts: ts}
}

func TestRealUpgrade_PresenceReconnectSurvivesLastDisconnectRace(t *testing.T) {
	db := realtimeTestPool(t)
	redisURL := os.Getenv("TEST_REDIS_URL")
	if redisURL == "" {
		t.Skip("TEST_REDIS_URL not set; skipping Redis integration test")
	}
	options, err := redis.ParseURL(redisURL)
	if err != nil {
		t.Fatalf("parse TEST_REDIS_URL: %v", err)
	}
	rdb := redis.NewClient(options)
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		t.Fatalf("ping test Redis: %v", err)
	}
	t.Cleanup(func() { _ = rdb.Close() })

	store := session.NewStore(db)
	userID, raw := seedLearnerSession(t, db, store)
	otherUserID, otherRaw := seedLearnerSession(t, db, store)
	presence := NewPresenceService(rdb)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_, _ = rdb.HDel(ctx, presenceOnlineKey, userID).Result()
	_, _ = rdb.HDel(ctx, presenceLastSeenKey, userID).Result()
	t.Cleanup(func() {
		cleanupCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		for _, id := range []string{userID, otherUserID} {
			_, _ = rdb.HDel(cleanupCtx, presenceOnlineKey, id).Result()
			_, _ = rdb.HDel(cleanupCtx, presenceLastSeenKey, id).Result()
		}
	})

	f := newUpgradeFixture(t, store)
	f.srv.presence.SetService(presence)
	c1, resp, err := f.dial(t, "/ws/presence", cookieHeader("bjt_web_session", raw, ""))
	requireUpgraded(t, resp, err)
	waitFor(t, "first connection online", func() bool {
		online, err := presence.IsOnline(ctx, userID)
		return err == nil && online
	})

	hook := &presenceReconnectRaceHook{
		userID:              userID,
		offlineStarted:      make(chan struct{}),
		releaseOffline:      make(chan struct{}),
		onlineDuringOffline: make(chan struct{}, 1),
	}
	rdb.AddHook(hook)
	t.Cleanup(hook.release)
	if err := c1.Close(websocket.StatusNormalClosure, "race fixture"); err != nil {
		t.Fatalf("close final presence connection: %v", err)
	}
	select {
	case <-hook.offlineStarted:
	case <-time.After(3 * time.Second):
		t.Fatal("last disconnect did not begin Redis offline transition")
	}

	c2, resp, err := f.dial(t, "/ws/presence", cookieHeader("bjt_web_session", raw, ""))
	requireUpgraded(t, resp, err)
	c3, resp, err := f.dial(t, "/ws/presence", cookieHeader("bjt_web_session", otherRaw, ""))
	requireUpgraded(t, resp, err)
	defer c3.CloseNow()
	otherOnline := false
	deadline := time.Now().Add(250 * time.Millisecond)
	for time.Now().Before(deadline) {
		otherOnline, err = presence.IsOnline(ctx, otherUserID)
		if err == nil && otherOnline {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	if !otherOnline {
		t.Fatal("unrelated user's presence connect blocked by another user's disconnect")
	}
	select {
	case <-hook.onlineDuringOffline:
		t.Fatalf("reconnect wrote online while the prior disconnect was still removing it")
	case <-time.After(250 * time.Millisecond):
	}
	hook.release()
	waitFor(t, "reconnected user online after prior disconnect", func() bool {
		online, err := presence.IsOnline(ctx, userID)
		return err == nil && online
	})
	_ = c2.Close(websocket.StatusNormalClosure, "test complete")
}

type presenceReconnectRaceHook struct {
	userID              string
	offlineStarted      chan struct{}
	releaseOffline      chan struct{}
	onlineDuringOffline chan struct{}
	offlineOnce         sync.Once
	releaseOnce         sync.Once
}

func (h *presenceReconnectRaceHook) DialHook(next redis.DialHook) redis.DialHook { return next }

func (h *presenceReconnectRaceHook) ProcessHook(next redis.ProcessHook) redis.ProcessHook {
	return next
}

func (h *presenceReconnectRaceHook) ProcessPipelineHook(next redis.ProcessPipelineHook) redis.ProcessPipelineHook {
	return func(ctx context.Context, cmds []redis.Cmder) error {
		for _, cmd := range cmds {
			args := cmd.Args()
			if len(args) < 3 || fmt.Sprint(args[2]) != h.userID {
				continue
			}
			if cmd.Name() == "hdel" && fmt.Sprint(args[1]) == presenceOnlineKey {
				h.offlineOnce.Do(func() {
					close(h.offlineStarted)
					<-h.releaseOffline
				})
			}
			if cmd.Name() == "hset" && fmt.Sprint(args[1]) == presenceOnlineKey {
				select {
				case <-h.offlineStarted:
					select {
					case <-h.releaseOffline:
					default:
						select {
						case h.onlineDuringOffline <- struct{}{}:
						default:
						}
					}
				default:
				}
			}
		}
		return next(ctx, cmds)
	}
}

func (h *presenceReconnectRaceHook) release() {
	h.releaseOnce.Do(func() { close(h.releaseOffline) })
}

func (f *upgradeFixture) wsURL(path string) string {
	return "ws" + strings.TrimPrefix(f.ts.URL, "http") + path
}

func (f *upgradeFixture) dial(t *testing.T, path string, header http.Header) (*websocket.Conn, *http.Response, error) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	conn, resp, err := websocket.Dial(ctx, f.wsURL(path), &websocket.DialOptions{HTTPHeader: header})
	if resp != nil && resp.Body != nil {
		_ = resp.Body.Close()
	}
	if conn != nil {
		t.Cleanup(func() { _ = conn.CloseNow() })
	}
	return conn, resp, err
}

func cookieHeader(name, value, origin string) http.Header {
	h := http.Header{}
	if name != "" {
		h.Set("Cookie", name+"="+value)
	}
	if origin != "" {
		h.Set("Origin", origin)
	}
	return h
}

func requireRejected(t *testing.T, resp *http.Response, err error, wantStatus int) {
	t.Helper()
	if err == nil {
		t.Fatalf("expected upgrade to be rejected with %d, but it succeeded", wantStatus)
	}
	if resp == nil {
		t.Fatalf("expected HTTP %d rejection, got transport error: %v", wantStatus, err)
	}
	if resp.StatusCode != wantStatus {
		t.Fatalf("expected HTTP %d, got %d (%v)", wantStatus, resp.StatusCode, err)
	}
}

func requireUpgraded(t *testing.T, resp *http.Response, err error) {
	t.Helper()
	if err != nil {
		status := 0
		if resp != nil {
			status = resp.StatusCode
		}
		t.Fatalf("expected successful upgrade, got status=%d err=%v", status, err)
	}
	if resp.StatusCode != http.StatusSwitchingProtocols {
		t.Fatalf("expected 101 Switching Protocols, got %d", resp.StatusCode)
	}
}

func writeEvent(t *testing.T, c *websocket.Conn, raw string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := c.Write(ctx, websocket.MessageText, []byte(raw)); err != nil {
		t.Fatalf("write %s: %v", raw, err)
	}
}

func readEvent(t *testing.T, c *websocket.Conn) Message {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	typ, data, err := c.Read(ctx)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if typ != websocket.MessageText {
		t.Fatalf("expected text frame, got %v", typ)
	}
	var msg Message
	if err := json.Unmarshal(data, &msg); err != nil {
		t.Fatalf("server sent non-JSON frame %q: %v", data, err)
	}
	return msg
}

// waitFor polls cond until it holds or the deadline passes.
func waitFor(t *testing.T, what string, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for %s", what)
}

// --- Anonymous / malformed credentials: no database required ---------------

func TestRealUpgrade_AnonymousRejected(t *testing.T) {
	// A store without a pool is never queried on these paths: the guard and
	// the presence handler reject before any lookup when no cookie is sent.
	f := newUpgradeFixture(t, session.NewStore(nil))
	for _, path := range []string{"/ws/battle", "/ws/presence"} {
		t.Run(path, func(t *testing.T) {
			_, resp, err := f.dial(t, path, cookieHeader("", "", trustedTestOrigin))
			requireRejected(t, resp, err, http.StatusUnauthorized)
		})
	}
	if n := len(f.srv.hub.OnlineUsers()); n != 0 {
		t.Fatalf("rejected upgrades must not register connections; hub has %d users", n)
	}
}

func TestRealUpgrade_MalformedTokenRejected(t *testing.T) {
	// Malformed tokens fail ValidateRawToken before any SQL is issued.
	f := newUpgradeFixture(t, session.NewStore(nil))
	_, resp, err := f.dial(t, "/ws/battle", cookieHeader("bjt_web_session", "not-a-token", trustedTestOrigin))
	requireRejected(t, resp, err, http.StatusUnauthorized)
	_, resp, err = f.dial(t, "/ws/presence", cookieHeader("bjt_web_session", "not-a-token", trustedTestOrigin))
	requireRejected(t, resp, err, http.StatusUnauthorized)
}

// --- Authenticated paths: real PostgreSQL ------------------------------------

func realtimeTestPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping integration test (requires disposable PostgreSQL 17 with the canonical schema)")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatalf("failed to connect to test DB: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

func newTestUUID(t *testing.T) string {
	t.Helper()
	var b [16]byte
	if _, err := crand.Read(b[:]); err != nil {
		t.Fatalf("crypto/rand: %v", err)
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

// seedLearnerSession creates an active learner and returns (userID, raw session token).
func seedLearnerSession(t *testing.T, db *pgxpool.Pool, store *session.Store) (string, string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	userID := newTestUUID(t)
	if _, err := db.Exec(ctx,
		`INSERT INTO profile.user_profile (id, display_name, email, status, updated_at) VALUES ($1, 'WS Learner', $2, 'active', now())`,
		userID, fmt.Sprintf("ws-%s@example.com", userID[:8])); err != nil {
		t.Fatalf("seed learner: %v", err)
	}
	t.Cleanup(func() {
		cctx, ccancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer ccancel()
		_, _ = db.Exec(cctx, `DELETE FROM profile.user_profile WHERE id = $1`, userID)
	})
	raw, err := store.CreateLearnerSession(ctx, userID, "ws-test", "127.0.0.1", time.Now().Add(time.Hour))
	if err != nil {
		t.Fatalf("create learner session: %v", err)
	}
	return userID, raw
}

// seedAdminSession creates an active admin actor and returns (actorID, raw session token).
func seedAdminSession(t *testing.T, db *pgxpool.Pool, store *session.Store) (string, string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	actorID := newTestUUID(t)
	if _, err := db.Exec(ctx,
		`INSERT INTO authz.admin_actor (id, display_name, email, status, updated_at) VALUES ($1, 'WS Admin', $2, 'active', now())`,
		actorID, fmt.Sprintf("ws-admin-%s@example.com", actorID[:8])); err != nil {
		t.Fatalf("seed admin: %v", err)
	}
	t.Cleanup(func() {
		cctx, ccancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer ccancel()
		_, _ = db.Exec(cctx, `DELETE FROM authz.admin_actor WHERE id = $1`, actorID)
	})
	raw, err := store.CreateAdminSession(ctx, actorID, "ws-test", "127.0.0.1", time.Now().Add(time.Hour))
	if err != nil {
		t.Fatalf("create admin session: %v", err)
	}
	return actorID, raw
}

func TestRealUpgrade_BattleProtocolAndLifecycle(t *testing.T) {
	db := realtimeTestPool(t)
	store := session.NewStore(db)
	f := newUpgradeFixture(t, store)
	userID, raw := seedLearnerSession(t, db, store)

	conn, resp, err := f.dial(t, "/ws/battle", cookieHeader("bjt_web_session", raw, trustedTestOrigin))
	requireUpgraded(t, resp, err)
	waitFor(t, "connection registration", func() bool { return f.srv.hub.UserConnCount(userID) == 1 })
	if got := f.srv.hub.UserNamespaceConnCount(userID, "battle"); got != 1 {
		t.Fatalf("battle connection count = %d, want 1", got)
	}
	writeEvent(t, conn, `{"event":"battle:lobby_join","data":{"userId":"spoofed","displayName":"Spoofed"}}`)
	lobbyAck := readEvent(t, conn)
	if lobbyAck.Event != "battle:lobby_joined" || !strings.Contains(string(lobbyAck.Data), userID) || !strings.Contains(string(lobbyAck.Data), "WS Learner") || strings.Contains(string(lobbyAck.Data), "Spoofed") {
		t.Fatalf("lobby identity must use the learner session: %s %s", lobbyAck.Event, lobbyAck.Data)
	}
	lobbyPresence := readEvent(t, conn)
	if lobbyPresence.Event != "battle:lobby_presence" || !strings.Contains(string(lobbyPresence.Data), "WS Learner") {
		t.Fatalf("expected authenticated lobby presence, got %s %s", lobbyPresence.Event, lobbyPresence.Data)
	}

	// Invalid frames are dropped without closing the connection.
	writeEvent(t, conn, `not json`)
	writeEvent(t, conn, `{"data":{}}`)
	writeEvent(t, conn, `{"event":"battle:unknown"}`)

	// battle:action is acknowledged to the sender with identity taken from the
	// session, never from the client payload.
	writeEvent(t, conn, `{"event":"battle:action","data":{"choice":2,"userId":"spoofed"}}`)
	ack := readEvent(t, conn)
	if ack.Event != "battle:action_ack" {
		t.Fatalf("expected battle:action_ack, got %q", ack.Event)
	}
	var ackData struct {
		UserID   string         `json:"userId"`
		Payload  map[string]any `json:"payload"`
		ServerTs int64          `json:"serverTs"`
	}
	if err := json.Unmarshal(ack.Data, &ackData); err != nil {
		t.Fatalf("decode ack: %v", err)
	}
	if ackData.UserID != userID {
		t.Fatalf("ack userId = %q, want session user %q", ackData.UserID, userID)
	}
	if ackData.Payload["choice"] != float64(2) || ackData.ServerTs <= 0 {
		t.Fatalf("unexpected ack data: %+v", ackData)
	}

	writeEvent(t, conn, `{"event":"battle:join"}`)
	joined := readEvent(t, conn)
	if joined.Event != "battle:player_joined" || !strings.Contains(string(joined.Data), userID) {
		t.Fatalf("expected battle:player_joined for %s, got %s %s", userID, joined.Event, joined.Data)
	}

	// Client-initiated close must unregister the connection and must not
	// crash the server (both read and write loops run teardown).
	if err := conn.Close(websocket.StatusNormalClosure, "bye"); err != nil && websocket.CloseStatus(err) == -1 {
		t.Fatalf("client close: %v", err)
	}
	waitFor(t, "connection unregistration", func() bool { return f.srv.hub.UserConnCount(userID) == 0 })

	// The server keeps serving after the teardown.
	conn2, resp, err := f.dial(t, "/ws/battle", cookieHeader("bjt_web_session", raw, trustedTestOrigin))
	requireUpgraded(t, resp, err)
	writeEvent(t, conn2, `{"event":"battle:action"}`)
	if got := readEvent(t, conn2).Event; got != "battle:action_ack" {
		t.Fatalf("server not serving after previous teardown: got %q", got)
	}
}

func TestRealUpgrade_BattleRejectsAdminSession(t *testing.T) {
	db := realtimeTestPool(t)
	store := session.NewStore(db)
	f := newUpgradeFixture(t, store)
	_, adminRaw := seedAdminSession(t, db, store)

	// Admin token in the admin cookie: battle is learner-only.
	_, resp, err := f.dial(t, "/ws/battle", cookieHeader("bjt_admin_session", adminRaw, trustedTestOrigin))
	requireRejected(t, resp, err, http.StatusUnauthorized)
	// Admin token replayed in the learner cookie must not be accepted either.
	_, resp, err = f.dial(t, "/ws/battle", cookieHeader("bjt_web_session", adminRaw, trustedTestOrigin))
	requireRejected(t, resp, err, http.StatusUnauthorized)
}

func TestRealUpgrade_PresenceAcceptsLearnerAndAdmin(t *testing.T) {
	db := realtimeTestPool(t)
	store := session.NewStore(db)
	f := newUpgradeFixture(t, store)
	userID, learnerRaw := seedLearnerSession(t, db, store)
	actorID, adminRaw := seedAdminSession(t, db, store)

	lc, resp, err := f.dial(t, "/ws/presence", cookieHeader("bjt_web_session", learnerRaw, trustedTestOrigin))
	requireUpgraded(t, resp, err)
	ac, resp, err := f.dial(t, "/ws/presence", cookieHeader("bjt_admin_session", adminRaw, trustedTestOrigin))
	requireUpgraded(t, resp, err)
	waitFor(t, "both presence connections", func() bool {
		return f.srv.hub.UserConnCount(userID) == 1 && f.srv.hub.UserConnCount(actorID) == 1
	})

	writeEvent(t, lc, `{"event":"presence:nope"}`)
	if got := readEvent(t, lc); got.Event != "presence:error" {
		t.Fatalf("expected presence:error for unknown event, got %q", got.Event)
	}

	_ = lc.Close(websocket.StatusNormalClosure, "")
	_ = ac.Close(websocket.StatusNormalClosure, "")
	waitFor(t, "presence teardown", func() bool { return len(f.srv.hub.OnlineUsers()) == 0 })
}

func TestRealUpgrade_PresenceMultipleConnectionsPerUser(t *testing.T) {
	db := realtimeTestPool(t)
	store := session.NewStore(db)
	f := newUpgradeFixture(t, store)
	userID, raw := seedLearnerSession(t, db, store)

	c1, resp, err := f.dial(t, "/ws/presence", cookieHeader("bjt_web_session", raw, trustedTestOrigin))
	requireUpgraded(t, resp, err)
	c2, resp, err := f.dial(t, "/ws/presence", cookieHeader("bjt_web_session", raw, trustedTestOrigin))
	requireUpgraded(t, resp, err)
	waitFor(t, "two connections", func() bool { return f.srv.hub.UserConnCount(userID) == 2 })

	_ = c1.Close(websocket.StatusNormalClosure, "")
	waitFor(t, "one connection left", func() bool { return f.srv.hub.UserConnCount(userID) == 1 })

	// The surviving connection still works.
	writeEvent(t, c2, `{"event":"presence:nope"}`)
	if got := readEvent(t, c2); got.Event != "presence:error" {
		t.Fatalf("surviving connection broken: got %q", got.Event)
	}
	_ = c2.Close(websocket.StatusNormalClosure, "")
	waitFor(t, "all connections closed", func() bool { return f.srv.hub.UserConnCount(userID) == 0 })
}

func TestRealUpgrade_OriginPolicy(t *testing.T) {
	db := realtimeTestPool(t)
	store := session.NewStore(db)
	f := newUpgradeFixture(t, store)
	_, raw := seedLearnerSession(t, db, store)
	_, adminRaw := seedAdminSession(t, db, store)

	cases := []struct {
		name, path, cookie, token, origin string
		wantOK                            bool
	}{
		{"battle trusted origin", "/ws/battle", "bjt_web_session", raw, trustedTestOrigin, true},
		{"battle same-host origin", "/ws/battle", "bjt_web_session", raw, f.ts.URL, true},
		{"battle no origin (non-browser client)", "/ws/battle", "bjt_web_session", raw, "", true},
		{"battle untrusted origin", "/ws/battle", "bjt_web_session", raw, untrustedTestOrigin, false},
		{"battle trusted host wrong port", "/ws/battle", "bjt_web_session", raw, trustedTestOrigin + ":8443", false},
		{"presence learner untrusted origin", "/ws/presence", "bjt_web_session", raw, untrustedTestOrigin, false},
		{"presence admin untrusted origin", "/ws/presence", "bjt_admin_session", adminRaw, untrustedTestOrigin, false},
		{"presence admin trusted origin", "/ws/presence", "bjt_admin_session", adminRaw, trustedTestOrigin, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			conn, resp, err := f.dial(t, tc.path, cookieHeader(tc.cookie, tc.token, tc.origin))
			if tc.wantOK {
				requireUpgraded(t, resp, err)
				_ = conn.Close(websocket.StatusNormalClosure, "")
				return
			}
			requireRejected(t, resp, err, http.StatusForbidden)
		})
	}
}

func TestRealUpgrade_ConcurrentConnectDisconnect(t *testing.T) {
	db := realtimeTestPool(t)
	store := session.NewStore(db)
	f := newUpgradeFixture(t, store)
	userID, raw := seedLearnerSession(t, db, store)

	const n = 16
	errs := make(chan error, n)
	for i := 0; i < n; i++ {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			conn, resp, err := websocket.Dial(ctx, f.wsURL("/ws/battle"), &websocket.DialOptions{
				HTTPHeader: cookieHeader("bjt_web_session", raw, trustedTestOrigin),
			})
			if resp != nil && resp.Body != nil {
				_ = resp.Body.Close()
			}
			if err != nil {
				errs <- err
				return
			}
			if err := conn.Write(ctx, websocket.MessageText, []byte(`{"event":"battle:action"}`)); err != nil {
				errs <- err
				return
			}
			if _, _, err := conn.Read(ctx); err != nil {
				errs <- err
				return
			}
			errs <- conn.Close(websocket.StatusNormalClosure, "")
		}()
	}
	for i := 0; i < n; i++ {
		if err := <-errs; err != nil && !errors.Is(err, context.Canceled) && websocket.CloseStatus(err) == -1 {
			t.Errorf("client %d: %v", i, err)
		}
	}
	waitFor(t, "all concurrent connections unregistered", func() bool { return f.srv.hub.UserConnCount(userID) == 0 })
}
