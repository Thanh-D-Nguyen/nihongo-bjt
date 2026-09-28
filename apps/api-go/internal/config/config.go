// Package config loads and validates application configuration from environment variables.
package config

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"time"
)

// Config holds all validated application configuration.
type Config struct {
	Port                 string
	DatabaseURL          string
	RedisURL             string
	LogLevel             string
	ServerReadTimeout    time.Duration
	ServerWriteTimeout   time.Duration
	ServerIdleTimeout    time.Duration
	ShutdownTimeout      time.Duration
	DBPoolMaxConns       int32
	DBPoolMinConns       int32
	DBConnAcquireTimeout time.Duration
}

// Load reads configuration from environment variables and validates required fields.
// Returns safe error messages that never contain credentials or connection strings.
func Load() (*Config, error) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return nil, fmt.Errorf("config: DATABASE_URL is required")
	}
	// Validate DATABASE_URL is parseable; do not include it in errors
	if _, err := url.Parse(dbURL); err != nil {
		return nil, fmt.Errorf("config: DATABASE_URL is not a valid URL")
	}

	port := getEnv("API_GO_PORT", "4001")
	if err := validatePort(port); err != nil {
		return nil, fmt.Errorf("config: API_GO_PORT %w", err)
	}

	readTimeout, err := durEnv("SERVER_READ_TIMEOUT", 15*time.Second)
	if err != nil {
		return nil, fmt.Errorf("config: SERVER_READ_TIMEOUT %w", err)
	}
	writeTimeout, err := durEnv("SERVER_WRITE_TIMEOUT", 15*time.Second)
	if err != nil {
		return nil, fmt.Errorf("config: SERVER_WRITE_TIMEOUT %w", err)
	}
	idleTimeout, err := durEnv("SERVER_IDLE_TIMEOUT", 60*time.Second)
	if err != nil {
		return nil, fmt.Errorf("config: SERVER_IDLE_TIMEOUT %w", err)
	}
	shutdownTimeout, err := durEnv("SHUTDOWN_TIMEOUT", 10*time.Second)
	if err != nil {
		return nil, fmt.Errorf("config: SHUTDOWN_TIMEOUT %w", err)
	}
	acquireTimeout, err := durEnv("DB_CONN_ACQUIRE_TIMEOUT", 5*time.Second)
	if err != nil {
		return nil, fmt.Errorf("config: DB_CONN_ACQUIRE_TIMEOUT %w", err)
	}

	maxConns, err := int32Env("DB_POOL_MAX_CONNS", 20)
	if err != nil {
		return nil, fmt.Errorf("config: DB_POOL_MAX_CONNS %w", err)
	}
	minConns, err := int32Env("DB_POOL_MIN_CONNS", 2)
	if err != nil {
		return nil, fmt.Errorf("config: DB_POOL_MIN_CONNS %w", err)
	}
	if minConns < 1 {
		return nil, fmt.Errorf("config: DB_POOL_MIN_CONNS must be >= 1")
	}
	if maxConns < minConns {
		return nil, fmt.Errorf("config: DB_POOL_MAX_CONNS must be >= DB_POOL_MIN_CONNS")
	}

	cfg := &Config{
		Port:                 port,
		DatabaseURL:          dbURL,
		RedisURL:             os.Getenv("REDIS_URL"), // optional; empty = skip Redis in readiness
		LogLevel:             getEnv("LOG_LEVEL", "info"),
		ServerReadTimeout:    readTimeout,
		ServerWriteTimeout:   writeTimeout,
		ServerIdleTimeout:    idleTimeout,
		ShutdownTimeout:      shutdownTimeout,
		DBPoolMaxConns:       maxConns,
		DBPoolMinConns:       minConns,
		DBConnAcquireTimeout: acquireTimeout,
	}
	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func durEnv(key string, fallback time.Duration) (time.Duration, error) {
	v := os.Getenv(key)
	if v == "" {
		return fallback, nil
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return 0, fmt.Errorf("invalid duration %q: %w", v, err)
	}
	if d <= 0 {
		return 0, fmt.Errorf("must be positive, got %v", d)
	}
	return d, nil
}

func int32Env(key string, fallback int32) (int32, error) {
	v := os.Getenv(key)
	if v == "" {
		return fallback, nil
	}
	n, err := strconv.ParseInt(v, 10, 32)
	if err != nil {
		return 0, fmt.Errorf("invalid integer %q: %w", v, err)
	}
	if n <= 0 {
		return 0, fmt.Errorf("must be positive, got %d", n)
	}
	return int32(n), nil
}

func validatePort(port string) error {
	n, err := strconv.Atoi(port)
	if err != nil {
		return fmt.Errorf("invalid port %q: %w", port, err)
	}
	if n < 1 || n > 65535 {
		return fmt.Errorf("port %d out of range [1, 65535]", n)
	}
	return nil
}
