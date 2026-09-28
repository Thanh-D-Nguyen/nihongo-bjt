// Package httpserver provides the HTTP server, router, and health endpoints.
package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authz"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/postgres"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/profile"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/redisx"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

// Dependencies holds external dependencies required by the HTTP server.
type Dependencies struct {
	Config       *config.Config
	Logger       *slog.Logger
	DB           postgres.Pinger // nil if not configured; readiness returns 503
	Redis        redisx.Pinger   // nil if not configured; readiness reports not_configured
	SessionStore *session.Store  // nil if DB not configured
	ProfileStore *profile.Store  // nil if DB not configured
	RBACStore    *authz.Store    // nil if DB not configured
	Version      string
}

// NewRouter creates the chi router with all routes and middleware.
func NewRouter(deps Dependencies) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(slogMiddleware(deps.Logger))
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))

	// Health endpoints — no auth required.
	r.Get("/health/live", liveHandler())
	r.Get("/health/ready", readyHandler(deps))

	// Guard configuration.
	guardCfg := authn.DefaultGuardConfig(deps.Logger)
	// TODO(M3_ENDPOINTS): populate TrustedOrigins from config/env when CORS_ORIGINS is wired.
	// Empty list is valid but rejects all unsafe requests until configured.
	csrfCfg := authn.CSRFConfig{
		Logger: deps.Logger,
	}

	// Learner auth routes — guarded by learner session cookie + CSRF for unsafe methods.
	if deps.SessionStore != nil && deps.ProfileStore != nil {
		learnerGuard := authn.LearnerGuard(deps.SessionStore, guardCfg)

		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Get("/api/auth/me", learnerMeHandler(deps.ProfileStore, deps.Logger))
		})

		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Use(authn.CSRFGuard(csrfCfg))
			lr.Post("/api/auth/logout", learnerLogoutHandler(deps.SessionStore, deps.Logger, guardCfg.LearnerCookieName))
		})
	}

	// Admin auth routes — guarded by admin session cookie + CSRF for unsafe methods.
	if deps.SessionStore != nil && deps.RBACStore != nil {
		adminGuard := authn.AdminGuard(deps.SessionStore, guardCfg)

		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/session", adminSessionHandler(deps.Logger))
			ar.Get("/api/admin/me", adminMeHandler(deps.RBACStore, deps.Logger))
		})

		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Use(authn.CSRFGuard(csrfCfg))
			ar.Post("/api/admin/logout", adminLogoutHandler(deps.SessionStore, deps.Logger, guardCfg.AdminCookieName))
		})
	}

	return r
}

// Server wraps the HTTP server with configuration.
type Server struct {
	httpServer *http.Server
	logger     *slog.Logger
}

// NewServer creates a new configured HTTP server.
func NewServer(deps Dependencies, handler http.Handler) *Server {
	return &Server{
		httpServer: &http.Server{
			Addr:         ":" + deps.Config.Port,
			Handler:      handler,
			ReadTimeout:  deps.Config.ServerReadTimeout,
			WriteTimeout: deps.Config.ServerWriteTimeout,
			IdleTimeout:  deps.Config.ServerIdleTimeout,
		},
		logger: deps.Logger,
	}
}

// Start begins listening. It returns immediately; use Shutdown to stop.
func (s *Server) Start() error {
	s.logger.Info("HTTP server starting", "addr", s.httpServer.Addr)
	if err := s.httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("http server: %w", err)
	}
	return nil
}

// Shutdown gracefully stops the server with the given context deadline.
func (s *Server) Shutdown(ctx context.Context) error {
	s.logger.Info("HTTP server shutting down")
	return s.httpServer.Shutdown(ctx)
}

func liveHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"status": "ok",
		})
	}
}

func readyHandler(deps Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		status := "ok"
		httpStatus := http.StatusOK
		checks := map[string]string{}

		// Check PostgreSQL (required)
		if deps.DB == nil {
			checks["postgres"] = "fail"
			status = "degraded"
			httpStatus = http.StatusServiceUnavailable
			deps.Logger.Error("readiness: postgres not configured")
		} else if err := postgres.Ping(ctx, deps.DB); err != nil {
			checks["postgres"] = "fail"
			status = "degraded"
			httpStatus = http.StatusServiceUnavailable
			deps.Logger.Error("readiness: postgres ping failed", "error", err)
		} else {
			checks["postgres"] = "ok"
		}

		// Check Redis (optional)
		if deps.Redis == nil {
			checks["redis"] = "not_configured"
		} else if err := redisx.Ping(ctx, deps.Redis); err != nil {
			checks["redis"] = "fail"
			status = "degraded"
			httpStatus = http.StatusServiceUnavailable
			deps.Logger.Error("readiness: redis ping failed", "error", err)
		} else {
			checks["redis"] = "ok"
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(httpStatus)
		resp := map[string]interface{}{
			"status": status,
			"checks": checks,
		}
		if deps.Version != "" {
			resp["version"] = deps.Version
		}
		_ = json.NewEncoder(w).Encode(resp)
	}
}

func slogMiddleware(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
			next.ServeHTTP(ww, r)
			logger.LogAttrs(r.Context(), slog.LevelInfo, "request",
				slog.String("method", r.Method),
				slog.String("path", r.URL.Path),
				slog.Int("status", ww.Status()),
				slog.Duration("duration", time.Since(start)),
				slog.Int("bytes", ww.BytesWritten()),
			)
		})
	}
}
