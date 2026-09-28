package app

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/httpserver"
)

// TestComposition_NilRedis_Returns503Not500 verifies that when REDIS_URL is
// unset, the composed Dependencies.Redis interface is truly nil (not a
// typed-nil *redis.Client), so readiness returns 503 with safe JSON instead
// of panicking and returning 500 via middleware recovery.
func TestComposition_NilRedis_Returns503Not500(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/test")
	os.Unsetenv("REDIS_URL")

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("config load: %v", err)
	}

	deps := httpserver.Dependencies{
		Config:  cfg,
		Logger:  testLogger(),
		DB:      nil, // no DB configured → postgres fail
		Version: "test",
		// Redis intentionally omitted to simulate redisx.NewClient returning nil
	}

	router := httpserver.NewRouter(deps)

	req := httptest.NewRequest(http.MethodGet, "/health/ready", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503, got %d; body: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("response is not valid JSON: %v; body: %s", err, w.Body.String())
	}

	checks, ok := resp["checks"].(map[string]interface{})
	if !ok {
		t.Fatalf("missing checks map in response: %v", resp)
	}

	if checks["redis"] != "not_configured" {
		t.Errorf("expected redis=not_configured, got %v", checks["redis"])
	}
	if checks["postgres"] != "fail" {
		t.Errorf("expected postgres=fail, got %v", checks["postgres"])
	}
	if resp["status"] != "degraded" {
		t.Errorf("expected status=degraded, got %v", resp["status"])
	}
}

// TestComposition_LiveIndependentOfDeps verifies liveness never depends on
// DB or Redis, even when both are nil/unconfigured.
func TestComposition_LiveIndependentOfDeps(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/test")
	os.Unsetenv("REDIS_URL")

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("config load: %v", err)
	}

	deps := httpserver.Dependencies{
		Config:  cfg,
		Logger:  testLogger(),
		DB:      nil,
		Version: "test",
	}

	router := httpserver.NewRouter(deps)

	req := httptest.NewRequest(http.MethodGet, "/health/live", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("live must be independent of deps; expected 200, got %d", w.Code)
	}
}

func testLogger() *slog.Logger {
	return slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
}
