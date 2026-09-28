// Package app provides the application composition root.
package app

import (
	"context"
	"fmt"
	"log/slog"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/httpserver"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/postgres"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/redisx"
)

// App holds all application dependencies and manages lifecycle.
type App struct {
	Config  *config.Config
	Logger  *slog.Logger
	DB      *pgxpool.Pool
	Redis   *redis.Client
	Server  *httpserver.Server
	Version string
}

// New creates and initializes the application with all dependencies.
func New(version string) (*App, error) {
	cfg, err := config.Load()
	if err != nil {
		return nil, fmt.Errorf("app: %w", err)
	}

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: parseLogLevel(cfg.LogLevel),
	}))

	dbPool, err := postgres.NewPool(context.Background(), postgres.PoolConfig{
		URL:            cfg.DatabaseURL,
		MaxConns:       cfg.DBPoolMaxConns,
		MinConns:       cfg.DBPoolMinConns,
		AcquireTimeout: cfg.DBConnAcquireTimeout,
	})
	if err != nil {
		return nil, fmt.Errorf("app: %w", err)
	}

	redisClient, err := redisx.NewClient(redisx.ClientConfig{URL: cfg.RedisURL})
	if err != nil {
		return nil, fmt.Errorf("app: %w", err)
	}

	deps := httpserver.Dependencies{
		Config:  cfg,
		Logger:  logger,
		DB:      dbPool,
		Version: version,
	}
	// Guard against typed-nil interface: only assign Redis if the concrete
	// client is non-nil. A typed-nil *redis.Client assigned to a
	// redisx.Pinger interface is non-nil and causes readiness to panic.
	if redisClient != nil {
		deps.Redis = redisClient
	}

	router := httpserver.NewRouter(deps)
	server := httpserver.NewServer(deps, router)

	return &App{
		Config:  cfg,
		Logger:  logger,
		DB:      dbPool,
		Redis:   redisClient,
		Server:  server,
		Version: version,
	}, nil
}

// Shutdown closes all resources in reverse dependency order.
func (a *App) Shutdown(ctx context.Context) {
	a.Logger.Info("shutting down application")

	if err := a.Server.Shutdown(ctx); err != nil {
		a.Logger.Error("HTTP server shutdown error", "error", err)
	}
	if a.Redis != nil {
		if err := a.Redis.Close(); err != nil {
			a.Logger.Error("redis close error", "error", err)
		}
	}
	a.DB.Close()
	a.Logger.Info("application shutdown complete")
}

func parseLogLevel(level string) slog.Level {
	switch level {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}
