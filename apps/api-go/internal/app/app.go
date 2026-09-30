// Package app provides the application composition root.
package app

import (
	"context"
	"fmt"
	"log/slog"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"gocloud.dev/blob"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authz"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/credential"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/httpserver"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/jobs"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/media"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/onboarding"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/postgres"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/profile"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/redisx"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/search"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

// App holds all application dependencies and manages lifecycle.
type App struct {
	Config       *config.Config
	Logger       *slog.Logger
	DB           *pgxpool.Pool
	Redis        *redis.Client
	SessionStore *session.Store
	ProfileStore *profile.Store
	RBACStore    *authz.Store
	RateLimiter  *authn.RateLimiter
	Server       *httpserver.Server
	Scheduler    *jobs.Scheduler
	Version      string
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

	sessionStore := session.NewStore(dbPool)
	profileStore := profile.NewStore(dbPool)
	onboardingStore := onboarding.NewStore(dbPool)
	rbacStore := authz.NewStore(dbPool)
	credentialStore := credential.NewStore(dbPool)
	rateLimiter, err := authn.NewRateLimiter(authn.DefaultRateLimiterConfig())
	if err != nil {
		dbPool.Close()
		return nil, fmt.Errorf("app: rate limiter: %w", err)
	}

	// M11: Initialize Meilisearch client when configured.
	searchClient := search.NewClient(cfg.MeilisearchURL, cfg.MeilisearchAPIKey)

	// M7: Initialize LocalFS media store and bucket when MediaBasePath is set.
	var mediaStore *media.Store
	var mediaBucket *blob.Bucket
	if cfg.MediaBasePath != "" {
		bucket, err := media.OpenBucket(cfg.MediaBasePath)
		if err != nil {
			logger.Warn("media: failed to open bucket; media endpoints disabled", "path", cfg.MediaBasePath, "error", err)
		} else {
			mediaBucket = bucket
			mediaStore = media.NewStore(dbPool)
			logger.Info("media: localfs bucket initialized", "path", cfg.MediaBasePath)
		}
	}

	deps := httpserver.Dependencies{
		Config:          cfg,
		Logger:          logger,
		DB:              dbPool,
		DBPool:          dbPool,
		SessionStore:    sessionStore,
		ProfileStore:    profileStore,
		RBACStore:       rbacStore,
		CredentialStore: credentialStore,
		RateLimiter:     rateLimiter,
		SearchClient:    searchClient,
		MediaStore:      mediaStore,
		MediaBucket:     mediaBucket,
		OnboardingStore: onboardingStore,
		Version:         version,
	}
	// Guard against typed-nil interface: only assign Redis if the concrete
	// client is non-nil. A typed-nil *redis.Client assigned to a
	// redisx.Pinger interface is non-nil and causes readiness to panic.
	if redisClient != nil {
		deps.Redis = redisClient
	}

	router := httpserver.NewRouter(deps)
	server := httpserver.NewServer(deps, router)

	// Background jobs scheduler — config-driven enable/disable for cutover.
	jobsCfg := jobs.LoadConfig()
	scheduler := jobs.NewScheduler(dbPool, logger, jobsCfg)
	handlers := jobs.NewHandlers(dbPool, logger, jobsCfg)
	if err := jobs.RegisterAll(scheduler, handlers); err != nil {
		dbPool.Close()
		return nil, fmt.Errorf("app: jobs registration: %w", err)
	}
	scheduler.Start()

	return &App{
		Config:       cfg,
		Logger:       logger,
		DB:           dbPool,
		Redis:        redisClient,
		SessionStore: sessionStore,
		ProfileStore: profileStore,
		RBACStore:    rbacStore,
		RateLimiter:  rateLimiter,
		Server:       server,
		Scheduler:    scheduler,
		Version:      version,
	}, nil
}

// Shutdown closes all resources in reverse dependency order.
func (a *App) Shutdown(ctx context.Context) {
	a.Logger.Info("shutting down application")

	if err := a.Server.Shutdown(ctx); err != nil {
		a.Logger.Error("HTTP server shutdown error", "error", err)
	}
	if a.Scheduler != nil {
		a.Scheduler.Stop()
	}
	if a.RateLimiter != nil {
		a.RateLimiter.Stop()
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
