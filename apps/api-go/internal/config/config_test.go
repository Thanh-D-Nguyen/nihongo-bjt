package config

import (
	"os"
	"strings"
	"testing"
	"time"
)

func TestLoad_RequiresDatabaseURL(t *testing.T) {
	os.Unsetenv("DATABASE_URL")
	_, err := Load()
	if err == nil {
		t.Fatal("expected error when DATABASE_URL is missing")
	}
	if !strings.Contains(err.Error(), "DATABASE_URL is required") {
		t.Errorf("expected 'DATABASE_URL is required' in error, got: %v", err)
	}
}

func TestLoad_InvalidDatabaseURL(t *testing.T) {
	t.Setenv("DATABASE_URL", "://bad-url")
	_, err := Load()
	if err == nil {
		t.Fatal("expected error for invalid DATABASE_URL")
	}
	if !strings.Contains(err.Error(), "not a valid URL") {
		t.Errorf("expected 'not a valid URL' in error, got: %v", err)
	}
	// Ensure no secret leakage in error
	if strings.Contains(err.Error(), "secret") || strings.Contains(err.Error(), "password") {
		t.Errorf("error message may leak secrets: %v", err)
	}
}

func TestLoad_Defaults(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/test")
	os.Unsetenv("REDIS_URL")
	os.Unsetenv("API_GO_PORT")
	os.Unsetenv("LOG_LEVEL")
	os.Unsetenv("SERVER_READ_TIMEOUT")
	os.Unsetenv("DB_POOL_MAX_CONNS")
	os.Unsetenv("DB_POOL_MIN_CONNS")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.Port != "4001" {
		t.Errorf("expected default port 4001, got %s", cfg.Port)
	}
	if cfg.LogLevel != "info" {
		t.Errorf("expected default log level info, got %s", cfg.LogLevel)
	}
	if cfg.ServerReadTimeout != 15*time.Second {
		t.Errorf("expected default read timeout 15s, got %v", cfg.ServerReadTimeout)
	}
	if cfg.DBPoolMaxConns != 20 {
		t.Errorf("expected default max conns 20, got %d", cfg.DBPoolMaxConns)
	}
	if cfg.DBPoolMinConns != 2 {
		t.Errorf("expected default min conns 2, got %d", cfg.DBPoolMinConns)
	}
	if cfg.RedisURL != "" {
		t.Errorf("expected empty redis url, got %s", cfg.RedisURL)
	}
}

func TestLoad_CustomValues(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/test")
	t.Setenv("REDIS_URL", "redis://localhost:6379")
	t.Setenv("API_GO_PORT", "8080")
	t.Setenv("LOG_LEVEL", "debug")
	t.Setenv("SERVER_READ_TIMEOUT", "30s")
	t.Setenv("DB_POOL_MAX_CONNS", "50")
	t.Setenv("DB_POOL_MIN_CONNS", "5")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.Port != "8080" {
		t.Errorf("expected port 8080, got %s", cfg.Port)
	}
	if cfg.RedisURL != "redis://localhost:6379" {
		t.Errorf("expected redis url, got %s", cfg.RedisURL)
	}
	if cfg.LogLevel != "debug" {
		t.Errorf("expected debug, got %s", cfg.LogLevel)
	}
	if cfg.ServerReadTimeout != 30*time.Second {
		t.Errorf("expected 30s, got %v", cfg.ServerReadTimeout)
	}
	if cfg.DBPoolMaxConns != 50 {
		t.Errorf("expected 50, got %d", cfg.DBPoolMaxConns)
	}
	if cfg.DBPoolMinConns != 5 {
		t.Errorf("expected 5, got %d", cfg.DBPoolMinConns)
	}
}

func TestLoad_InvalidPort(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/test")
	t.Setenv("API_GO_PORT", "99999")
	_, err := Load()
	if err == nil {
		t.Fatal("expected error for out-of-range port")
	}
	if !strings.Contains(err.Error(), "out of range") {
		t.Errorf("expected 'out of range' in error, got: %v", err)
	}
}

func TestLoad_InvalidPortNonNumeric(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/test")
	t.Setenv("API_GO_PORT", "abc")
	_, err := Load()
	if err == nil {
		t.Fatal("expected error for non-numeric port")
	}
	if !strings.Contains(err.Error(), "invalid port") {
		t.Errorf("expected 'invalid port' in error, got: %v", err)
	}
}

func TestLoad_NegativeTimeout(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/test")
	t.Setenv("SERVER_READ_TIMEOUT", "-5s")
	_, err := Load()
	if err == nil {
		t.Fatal("expected error for negative timeout")
	}
	if !strings.Contains(err.Error(), "must be positive") {
		t.Errorf("expected 'must be positive' in error, got: %v", err)
	}
}

func TestLoad_InvalidDuration(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/test")
	t.Setenv("SERVER_WRITE_TIMEOUT", "notaduration")
	_, err := Load()
	if err == nil {
		t.Fatal("expected error for invalid duration")
	}
	if !strings.Contains(err.Error(), "invalid duration") {
		t.Errorf("expected 'invalid duration' in error, got: %v", err)
	}
}

func TestLoad_PoolMinLessThanOne(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/test")
	t.Setenv("DB_POOL_MIN_CONNS", "0")
	_, err := Load()
	if err == nil {
		t.Fatal("expected error for min conns < 1")
	}
	if !strings.Contains(err.Error(), "must be positive") {
		t.Errorf("expected 'must be positive' in error, got: %v", err)
	}
}

func TestLoad_PoolMaxLessThanMin(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/test")
	t.Setenv("DB_POOL_MAX_CONNS", "2")
	t.Setenv("DB_POOL_MIN_CONNS", "5")
	_, err := Load()
	if err == nil {
		t.Fatal("expected error for max < min")
	}
	if !strings.Contains(err.Error(), "must be >= DB_POOL_MIN_CONNS") {
		t.Errorf("expected 'must be >= DB_POOL_MIN_CONNS' in error, got: %v", err)
	}
}

func TestLoad_NoSecretLeakageInErrors(t *testing.T) {
	sentinelPassword := "SUPER_SECRET_PASSWORD_12345"
	t.Setenv("DATABASE_URL", "postgres://user:"+sentinelPassword+"@localhost:5432/db")
	t.Setenv("API_GO_PORT", "invalid")
	_, err := Load()
	if err == nil {
		t.Fatal("expected error")
	}
	if strings.Contains(err.Error(), sentinelPassword) {
		t.Errorf("error message leaks password: %v", err)
	}
}

func TestLoad_CORSOrigins_Valid(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/test")
	t.Setenv("CORS_ORIGINS", "https://app.example.com, http://localhost:3000 , https://admin.example.com")
	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(cfg.CORSOrigins) != 3 {
		t.Fatalf("expected 3 origins, got %d: %v", len(cfg.CORSOrigins), cfg.CORSOrigins)
	}
	want := []string{"https://app.example.com", "http://localhost:3000", "https://admin.example.com"}
	for i, w := range want {
		if cfg.CORSOrigins[i] != w {
			t.Errorf("origin[%d] = %q, want %q", i, cfg.CORSOrigins[i], w)
		}
	}
}

func TestLoad_CORSOrigins_Empty(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/test")
	t.Setenv("CORS_ORIGINS", "")
	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.CORSOrigins != nil {
		t.Errorf("expected nil origins for empty input, got %v", cfg.CORSOrigins)
	}
}

func TestLoad_CORSOrigins_InvalidScheme(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/test")
	t.Setenv("CORS_ORIGINS", "ftp://example.com")
	_, err := Load()
	if err == nil {
		t.Fatal("expected error for non-http scheme")
	}
	if !strings.Contains(err.Error(), "scheme must be http or https") {
		t.Errorf("expected scheme error, got: %v", err)
	}
}

func TestLoad_CORSOrigins_MissingHost(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/test")
	t.Setenv("CORS_ORIGINS", "https://")
	_, err := Load()
	if err == nil {
		t.Fatal("expected error for missing host")
	}
	if !strings.Contains(err.Error(), "missing host") {
		t.Errorf("expected missing host error, got: %v", err)
	}
}

func TestLoad_CORSOrigins_PathNotAllowed(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/test")
	t.Setenv("CORS_ORIGINS", "https://example.com/api")
	_, err := Load()
	if err == nil {
		t.Fatal("expected error for path in origin")
	}
	if !strings.Contains(err.Error(), "path not allowed") {
		t.Errorf("expected path error, got: %v", err)
	}
}

func TestLoad_CORSOrigins_UserinfoNotAllowed(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/test")
	t.Setenv("CORS_ORIGINS", "https://user:pass@example.com")
	_, err := Load()
	if err == nil {
		t.Fatal("expected error for userinfo in origin")
	}
	if !strings.Contains(err.Error(), "userinfo not allowed") {
		t.Errorf("expected userinfo error, got: %v", err)
	}
}
