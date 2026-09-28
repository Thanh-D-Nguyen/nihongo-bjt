package config

import (
	"os"
	"testing"
	"time"
)

func TestLoad_RequiresDatabaseURL(t *testing.T) {
	os.Unsetenv("DATABASE_URL")
	_, err := Load()
	if err == nil {
		t.Fatal("expected error when DATABASE_URL is missing")
	}
}

func TestLoad_Defaults(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/test")
	os.Unsetenv("REDIS_URL")
	os.Unsetenv("API_GO_PORT")
	os.Unsetenv("LOG_LEVEL")

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
}

func TestMaskedDatabaseURL(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"postgres://user:secret@localhost:5432/db", "postgres://user:***@localhost:5432/db"},
		{"postgres://localhost/db", "postgres://localhost/db"},
		{"", ""},
	}
	for _, tt := range tests {
		got := MaskedDatabaseURL(tt.input)
		if got != tt.expected {
			t.Errorf("MaskedDatabaseURL(%q) = %q, want %q", tt.input, got, tt.expected)
		}
	}
}
