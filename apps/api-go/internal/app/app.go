// Package app provides the application composition root.
package app

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"gocloud.dev/blob"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authlink"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authz"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/career"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/credential"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/email"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/exercisereview"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/flashcarddeck"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/flashcardreview"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/flashcardstyle"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/gamification"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/httpserver"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/jobs"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/loto"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/media"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/notification"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/onboarding"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/placement"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/postgres"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/privacy"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/profile"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/quiztemplate"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/realtime"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/redisx"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/scenario"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/search"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/studyplan"
)

// App holds all application dependencies and manages lifecycle.
type App struct {
	Config                *config.Config
	Logger                *slog.Logger
	DB                    *pgxpool.Pool
	Redis                 *redis.Client
	SessionStore          *session.Store
	ProfileStore          *profile.Store
	RBACStore             *authz.Store
	RateLimiter           *authn.RateLimiter
	PublicReadRateLimiter *authn.RateLimiter
	PasswordResetMailer   *email.SMTP
	PasswordResetQueue    *httpserver.PasswordResetQueue
	Server                *httpserver.Server
	Scheduler             *jobs.Scheduler
	Version               string
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
	notificationStore := notification.NewStore(dbPool)
	privacyStore := privacy.NewStore(dbPool)
	authLinkStore := authlink.NewStore(dbPool)
	placementStore := placement.NewStore(dbPool)
	gamificationStore := gamification.NewStore(dbPool)
	exerciseReviewStore := exercisereview.NewStore(dbPool)
	flashcardStyleStore := flashcardstyle.NewStore(dbPool)
	flashcardReviewStore := flashcardreview.NewStore(dbPool)
	flashcardDeckStore := flashcarddeck.NewStore(dbPool)
	quizTemplateStore := quiztemplate.NewStore(dbPool)
	studyPlanStore := studyplan.NewStore(dbPool)
	scenarioStore := scenario.NewStore(dbPool)
	careerStore := career.NewStore(dbPool)
	rbacStore := authz.NewStore(dbPool)
	credentialStore := credential.NewStore(dbPool)
	rateLimiter, err := authn.NewRateLimiter(authn.DefaultRateLimiterConfig())
	if err != nil {
		dbPool.Close()
		return nil, fmt.Errorf("app: rate limiter: %w", err)
	}
	publicReadRateLimiter, err := authn.NewRateLimiter(authn.DefaultPublicReadRateLimiterConfig())
	if err != nil {
		rateLimiter.Stop()
		dbPool.Close()
		return nil, fmt.Errorf("app: public read rate limiter: %w", err)
	}
	var resetMailer *email.SMTP
	if cfg.SMTPAddress != "" {
		resetMailer, err = email.NewSMTP(cfg.SMTPAddress, cfg.SMTPFrom, cfg.SMTPUsername, cfg.SMTPPassword, cfg.WebPublicURL, cfg.SMTPRequireStartTLS)
		if err != nil {
			publicReadRateLimiter.Stop()
			rateLimiter.Stop()
			dbPool.Close()
			return nil, fmt.Errorf("app: password reset mailer: %w", err)
		}
	}
	var resetQueue *httpserver.PasswordResetQueue
	if resetMailer != nil {
		resetQueue = httpserver.NewPasswordResetQueue(dbPool, resetMailer, logger)
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

	lotoService := loto.NewService(dbPool, logger)
	lotoSource := loto.ResultSource(nil)
	if jobs.LoadConfig().LotoAutopilotEnabled {
		lotoSource = lotoService.Source
	}
	deps := httpserver.Dependencies{
		LotoResultSource:      lotoSource,
		Config:                cfg,
		Logger:                logger,
		DB:                    dbPool,
		DBPool:                dbPool,
		SessionStore:          sessionStore,
		ProfileStore:          profileStore,
		RBACStore:             rbacStore,
		CredentialStore:       credentialStore,
		RateLimiter:           rateLimiter,
		PublicReadRateLimiter: publicReadRateLimiter,
		PresenceService:       realtime.NewPresenceService(redisClient),
		PasswordResetQueue:    resetQueue,
		SearchClient:          searchClient,
		MediaStore:            mediaStore,
		MediaBucket:           mediaBucket,
		OnboardingStore:       onboardingStore,
		NotificationStore:     notificationStore,
		PrivacyStore:          privacyStore,
		AuthLinkStore:         authLinkStore,
		PlacementStore:        placementStore,
		GamificationStore:     gamificationStore,
		ExerciseReviewStore:   exerciseReviewStore,
		FlashcardStyleStore:   flashcardStyleStore,
		FlashcardReviewStore:  flashcardReviewStore,
		FlashcardDeckStore:    flashcardDeckStore,
		QuizTemplateStore:     quizTemplateStore,
		StudyPlanStore:        studyPlanStore,
		ScenarioStore:         scenarioStore,
		CareerStore:           careerStore,
		Version:               version,
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
	handlers.NHKNewsSyncFunc = func(ctx context.Context) (int, error) {
		return httpserver.SyncNHKNewsFeeds(ctx, dbPool, logger)
	}
	handlers.LotoAutopilotFunc = func(ctx context.Context, game string) (int, error) {
		parsed, ok := loto.ParseGame(game)
		if !ok {
			return 0, fmt.Errorf("loto autopilot: unknown game %q", game)
		}
		return lotoService.JobCount(ctx, parsed)
	}
	if err := jobs.RegisterAll(scheduler, handlers); err != nil {
		publicReadRateLimiter.Stop()
		rateLimiter.Stop()
		dbPool.Close()
		return nil, fmt.Errorf("app: jobs registration: %w", err)
	}
	scheduler.Start()
	if jobsCfg.Enabled && jobsCfg.LotoAutopilotEnabled {
		// Reconcile after every deploy: import results, publish the next reference
		// set and top up the backtest history.
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()
			for game, result := range lotoService.Reconcile(ctx) {
				logger.Info("jobs: startup loto autopilot completed", "game", game, "status", result.Status, "backtests", result.Backtests)
			}
		}()
	}
	if jobsCfg.Enabled {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
			defer cancel()
			count, err := httpserver.SyncNHKNewsFeeds(ctx, dbPool, logger)
			if err != nil {
				logger.Warn("jobs: startup nhk_news_sync failed", "error", err)
				return
			}
			logger.Info("jobs: startup nhk_news_sync completed", "items_processed", count)
		}()
	}

	return &App{
		Config:                cfg,
		Logger:                logger,
		DB:                    dbPool,
		Redis:                 redisClient,
		SessionStore:          sessionStore,
		ProfileStore:          profileStore,
		RBACStore:             rbacStore,
		RateLimiter:           rateLimiter,
		PublicReadRateLimiter: publicReadRateLimiter,
		PasswordResetMailer:   resetMailer,
		PasswordResetQueue:    resetQueue,
		Server:                server,
		Scheduler:             scheduler,
		Version:               version,
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
	if a.PublicReadRateLimiter != nil {
		a.PublicReadRateLimiter.Stop()
	}
	if a.PasswordResetQueue != nil {
		if err := a.PasswordResetQueue.Close(ctx); err != nil {
			a.Logger.Error("password reset queue shutdown error", "error", err)
		}
	}
	if a.PasswordResetMailer != nil {
		if err := a.PasswordResetMailer.Close(ctx); err != nil {
			a.Logger.Error("password reset mailer shutdown error", "error", err)
		}
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
