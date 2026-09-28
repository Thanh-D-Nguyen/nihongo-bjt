// Package config loads and validates application configuration from environment variables.
package config

import (
	"fmt"
	"os"
	"strings"
	"time"
)

// Config holds all validated application configuration.
type Config struct {
	Port        string
	DatabaseURL string
	RedisURL    string
	LogLevel    string

	ServerReadTimeout  time.Duration
	ServerWriteTimeout time.Duration
	ServerIdleTimeout  time.Duration
	ShutdownTimeout    time.Duration

	DBPoolMaxConns       int32
	DBPoolMinConns       int32
	DBConnAcquireTimeout time.Duration
}

// Load reads configuration from environment variables and validates required fields.
func Load() (*Config, error) {
	port := getEnv("API_GO_PORT", "4001")
	dbURL := os.Getenv("DATABASE_URL")
	redisURL := os.Getenv("REDIS_URL")
	logLevel := getEnv("LOG_LEVEL", "info")

	if dbURL == "" {
		return nil, fmt.Errorf("config: DATABASE_URL is required")
	}

	cfg := &Config{
		Port:                 port,
		DatabaseURL:          dbURL,
		RedisURL:             redisURL, // optional; readiness skips Redis check if empty
		LogLevel:             logLevel,
		ServerReadTimeout:    durEnv("SERVER_READ_TIMEOUT", 15*time.Second),
		ServerWriteTimeout:   durEnv("SERVER_WRITE_TIMEOUT", 15*time.Second),
		ServerIdleTimeout:    durEnv("SERVER_IDLE_TIMEOUT", 60*time.Second),
		ShutdownTimeout:      durEnv("SHUTDOWN_TIMEOUT", 10*time.Second),
		DBPoolMaxConns:       int32Env("DB_POOL_MAX_CONNS", 20),
		DBPoolMinConns:       int32Env("DB_POOL_MIN_CONNS", 2),
		DBConnAcquireTimeout: durEnv("DB_CONN_ACQUIRE_TIMEOUT", 5*time.Second),
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func durEnv(key string, fallback time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return fallback
	}
	return d
}

func int32Env(key string, fallback int32) int32 {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	var n int32
	for _, c := range v {
		if c < '0' || c > '9' {
			return fallback
		}
		n = n*10 + int32(c-'0')
	}
	return n
}

// MaskedDatabaseURL returns DATABASE_URL with password redacted for logging.
func MaskedDatabaseURL(raw string) string {
	// Standard URL format: scheme://user:pass@host/path
	schemeEnd := strings.Index(raw, "://")
	if schemeEnd < 0 {
		return raw
	}
	prefix := raw[:schemeEnd+3] // e.g. "postgres://"
	remainder := raw[schemeEnd+3:]

	at := strings.Index(remainder, "@")
	if at < 0 {
		return raw
	}
	userinfo := remainder[:at]
	host := remainder[at:] // "@host/path"

	colon := strings.Index(userinfo, ":")
	if colon < 0 {
		// No password present
		return raw
	}
	return prefix + userinfo[:colon+1] + "***" + host
}
