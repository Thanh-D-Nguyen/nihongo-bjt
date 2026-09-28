package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"log/slog"
	"os"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/redis/go-redis/v9"
)

// mockDBPinger implements postgres.Pinger for testing.
type mockDBPinger struct {
	err error
}

func (m *mockDBPinger) Ping(ctx context.Context) error {
	return m.err
}

// mockRedisPinger implements redisx.Pinger for testing.
type mockRedisPinger struct {
	err error
}

func (m *mockRedisPinger) Ping(ctx context.Context) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "PONG")
	if m.err != nil {
		cmd.SetErr(m.err)
	}
	return cmd
}

func newTestDeps(db Pinger, redisClient RedisPinger) Dependencies {
	return Dependencies{
		Config: &config.Config{
			Port:               "4001",
			ServerReadTimeout:  15 * time.Second,
			ServerWriteTimeout: 15 * time.Second,
			ServerIdleTimeout:  60 * time.Second,
		},
		Logger:  slog.New(slog.NewJSONHandler(os.Stdout, nil)),
		DB:      db,
		Redis:   redisClient,
		Version: "test",
	}
}

// Pinger and RedisPinger are type aliases to avoid importing postgres/redisx in tests.
// The actual types are satisfied by mockDBPinger and mockRedisPinger via duck typing
// since server.go uses the interfaces from those packages.
type Pinger = interface{ Ping(context.Context) error }
type RedisPinger = interface {
	Ping(context.Context) *redis.StatusCmd
}

func TestLiveHandler_AlwaysOK(t *testing.T) {
	deps := newTestDeps(nil, nil)
	router := NewRouter(deps)

	req := httptest.NewRequest(http.MethodGet, "/health/live", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	var resp map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp["status"] != "ok" {
		t.Errorf("expected status ok, got %s", resp["status"])
	}
}

func TestLiveHandler_IndependentOfDB(t *testing.T) {
	// Live should return 200 even when DB pinger would fail
	deps := newTestDeps(&mockDBPinger{err: context.DeadlineExceeded}, nil)
	router := NewRouter(deps)

	req := httptest.NewRequest(http.MethodGet, "/health/live", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("live must be independent of DB; expected 200, got %d", w.Code)
	}
}

func TestReadyHandler_HealthyAll(t *testing.T) {
	deps := newTestDeps(&mockDBPinger{err: nil}, &mockRedisPinger{err: nil})
	router := NewRouter(deps)

	req := httptest.NewRequest(http.MethodGet, "/health/ready", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp["status"] != "ok" {
		t.Errorf("expected status ok, got %v", resp["status"])
	}
	checks := resp["checks"].(map[string]interface{})
	if checks["postgres"] != "ok" {
		t.Errorf("expected postgres ok, got %v", checks["postgres"])
	}
	if checks["redis"] != "ok" {
		t.Errorf("expected redis ok, got %v", checks["redis"])
	}
}

func TestReadyHandler_NilDB_Returns503(t *testing.T) {
	deps := newTestDeps(nil, nil) // nil DB = not configured
	router := NewRouter(deps)

	req := httptest.NewRequest(http.MethodGet, "/health/ready", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503 for nil DB, got %d", w.Code)
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp["status"] != "degraded" {
		t.Errorf("expected status degraded, got %v", resp["status"])
	}
	checks := resp["checks"].(map[string]interface{})
	if checks["postgres"] != "fail" {
		t.Errorf("expected postgres fail, got %v", checks["postgres"])
	}
	if checks["redis"] != "not_configured" {
		t.Errorf("expected redis not_configured, got %v", checks["redis"])
	}
}

func TestReadyHandler_DBFailure_Returns503(t *testing.T) {
	deps := newTestDeps(&mockDBPinger{err: context.DeadlineExceeded}, nil)
	router := NewRouter(deps)

	req := httptest.NewRequest(http.MethodGet, "/health/ready", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503 for DB failure, got %d", w.Code)
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	checks := resp["checks"].(map[string]interface{})
	if checks["postgres"] != "fail" {
		t.Errorf("expected postgres fail, got %v", checks["postgres"])
	}
}

func TestReadyHandler_RedisFailure_Returns503(t *testing.T) {
	deps := newTestDeps(&mockDBPinger{err: nil}, &mockRedisPinger{err: context.DeadlineExceeded})
	router := NewRouter(deps)

	req := httptest.NewRequest(http.MethodGet, "/health/ready", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503 for Redis failure, got %d", w.Code)
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	checks := resp["checks"].(map[string]interface{})
	if checks["postgres"] != "ok" {
		t.Errorf("expected postgres ok, got %v", checks["postgres"])
	}
	if checks["redis"] != "fail" {
		t.Errorf("expected redis fail, got %v", checks["redis"])
	}
}

func TestReadyHandler_NoErrorDetailsInResponse(t *testing.T) {
	sentinelErr := "INTERNAL_DB_CONNECTION_REFUSED_SECRET_HOST_12345"
	deps := newTestDeps(&mockDBPinger{err: &sentinelError{msg: sentinelErr}}, nil)
	router := NewRouter(deps)

	req := httptest.NewRequest(http.MethodGet, "/health/ready", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	body := w.Body.String()
	if strings.Contains(body, sentinelErr) {
		t.Errorf("response body leaks internal error details: %s", body)
	}
	if strings.Contains(body, "SECRET") || strings.Contains(body, "HOST") {
		t.Errorf("response body may leak sensitive info: %s", body)
	}
}

type sentinelError struct{ msg string }

func (e *sentinelError) Error() string { return e.msg }

func TestReadyHandler_VersionIncluded(t *testing.T) {
	deps := newTestDeps(&mockDBPinger{err: nil}, nil)
	deps.Version = "v1.2.3"
	router := NewRouter(deps)

	req := httptest.NewRequest(http.MethodGet, "/health/ready", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp["version"] != "v1.2.3" {
		t.Errorf("expected version v1.2.3, got %v", resp["version"])
	}
}

func TestNewServer_Addr(t *testing.T) {
	deps := newTestDeps(nil, nil)
	router := NewRouter(deps)
	srv := NewServer(deps, router)

	if srv.httpServer.Addr != ":4001" {
		t.Errorf("expected addr :4001, got %s", srv.httpServer.Addr)
	}
}

func TestServer_ShutdownBeforeStart(t *testing.T) {
	deps := newTestDeps(nil, nil)
	router := NewRouter(deps)
	srv := NewServer(deps, router)

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		t.Errorf("shutdown before start should succeed, got: %v", err)
	}
}
